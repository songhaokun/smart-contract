// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/MneeMart.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock MNEE Stablecoin (1 MNEE = $1 USD, 18 decimals)
contract MockMNEE is ERC20 {
    constructor() ERC20("MNEE Stablecoin", "MNEE") {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MneeMartTest is Test {
    MneeMart public mart;
    MockMNEE public mneeToken;

    address public owner;
    address public seller1;
    address public seller2;
    address public buyer1;
    address public buyer2;

    uint256 public constant PLATFORM_FEE = 500; // 5%
    uint256 public constant INITIAL_BALANCE = 10000 * 1e18; // 10,000 MNEE ($10,000)

    // Events
    event ProductListed(uint256 indexed productId, address indexed seller, string cid, uint256 price);
    event ProductPurchased(
        uint256 indexed productId, address indexed buyer, address indexed seller, uint256 price, uint256 platformFee
    );
    event SellerWithdrawal(address indexed seller, uint256 amount);
    event PlatformWithdrawal(address indexed owner, uint256 amount);
    event ProductDeactivated(uint256 indexed productId);
    event ProductActivated(uint256 indexed productId);
    event ProductPriceUpdated(uint256 indexed productId, uint256 newPrice);
    event PlatformFeeUpdated(uint256 newFee);

    // Helper to convert dollar amounts to MNEE tokens (18 decimals)
    function dollars(uint256 amount) internal pure returns (uint256) {
        return amount * 1e18;
    }

    // Helper for cents
    function cents(uint256 amount) internal pure returns (uint256) {
        return (amount * 1e18) / 100;
    }

    function setUp() public {
        owner = address(this);
        seller1 = makeAddr("seller1");
        seller2 = makeAddr("seller2");
        buyer1 = makeAddr("buyer1");
        buyer2 = makeAddr("buyer2");

        mneeToken = new MockMNEE();
        mart = new MneeMart(address(mneeToken), PLATFORM_FEE);

        mneeToken.mint(seller1, INITIAL_BALANCE);
        mneeToken.mint(seller2, INITIAL_BALANCE);
        mneeToken.mint(buyer1, INITIAL_BALANCE);
        mneeToken.mint(buyer2, INITIAL_BALANCE);
    }

    // ==================== Deployment Tests ====================

    function test_Deployment_Success() public {
        assertEq(mart.owner(), owner);
        assertEq(address(mart.mneeToken()), address(mneeToken));
        assertEq(mart.platformFeePercentage(), PLATFORM_FEE);
        assertEq(mart.productCounter(), 0);
        assertEq(mart.platformBalance(), 0);
    }

    function test_Deployment_RevertIf_InvalidTokenAddress() public {
        vm.expectRevert(MneeMart.Mart_InvalidTokenAddress.selector);
        new MneeMart(address(0), PLATFORM_FEE);
    }

    function test_Deployment_RevertIf_PlatformFeeTooHigh() public {
        uint256 invalidFee = 2001;
        vm.expectRevert(abi.encodeWithSelector(MneeMart.Mart_PlatformFeeTooHigh.selector, invalidFee, 2000));
        new MneeMart(address(mneeToken), invalidFee);
    }

    function test_Deployment_MaxPlatformFeeAllowed() public {
        MneeMart newMart = new MneeMart(address(mneeToken), 2000);
        assertEq(newMart.platformFeePercentage(), 2000);
    }

    // ==================== List Product Tests ====================

    function test_ListProduct_Success() public {
        vm.startPrank(seller1);
        uint256 price = dollars(50);

        vm.expectEmit(true, true, false, true);
        emit ProductListed(1, seller1, "QmTest123", price);

        uint256 productId = mart.listProduct("QmTest123", price, "Digital Artwork");

        assertEq(productId, 1);
        assertEq(mart.productCounter(), 1);

        (uint256 id, address seller, uint256 storedPrice, string memory name, bool active, uint256 salesCount) =
            mart.getProduct(1);

        assertEq(id, 1);
        assertEq(seller, seller1);
        assertEq(storedPrice, price);
        assertEq(name, "Digital Artwork");
        assertTrue(active);
        assertEq(salesCount, 0);
        vm.stopPrank();
    }

    function test_ListProduct_VariousPricePoints() public {
        vm.startPrank(seller1);

        mart.listProduct("QmEbook", dollars(10), "E-Book");
        mart.listProduct("QmCourse", dollars(99), "Online Course");
        mart.listProduct("QmSoftware", cents(4999), "Software License");
        mart.listProduct("QmTemplate", cents(1500), "Design Template");

        (,, uint256 price1,,,) = mart.getProduct(1);
        (,, uint256 price2,,,) = mart.getProduct(2);
        (,, uint256 price3,,,) = mart.getProduct(3);
        (,, uint256 price4,,,) = mart.getProduct(4);

        assertEq(price1, dollars(10));
        assertEq(price2, dollars(99));
        assertEq(price3, cents(4999));
        assertEq(price4, cents(1500));
        vm.stopPrank();
    }

    function test_ListProduct_MultipleProducts() public {
        vm.startPrank(seller1);
        mart.listProduct("QmTest1", dollars(10), "Product 1");
        mart.listProduct("QmTest2", dollars(25), "Product 2");
        mart.listProduct("QmTest3", dollars(100), "Product 3");

        uint256[] memory sellerProducts = mart.getSellerProducts(seller1);
        assertEq(sellerProducts.length, 3);
        vm.stopPrank();
    }

    function test_ListProduct_RevertIf_EmptyCID() public {
        vm.startPrank(seller1);
        vm.expectRevert(MneeMart.EmptyCID.selector);
        mart.listProduct("", dollars(10), "Test Product");
        vm.stopPrank();
    }

    function test_ListProduct_RevertIf_InvalidPrice() public {
        vm.startPrank(seller1);
        vm.expectRevert(abi.encodeWithSelector(MneeMart.InvalidPrice.selector, 0));
        mart.listProduct("QmTest123", 0, "Test Product");
        vm.stopPrank();
    }

    function test_ListProduct_RevertIf_EmptyName() public {
        vm.startPrank(seller1);
        vm.expectRevert(MneeMart.EmptyName.selector);
        mart.listProduct("QmTest123", dollars(10), "");
        vm.stopPrank();
    }

    // ==================== Purchase Product Tests ====================

    function test_PurchaseProduct_Success() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Digital Art");

        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), dollars(50));

        uint256 platformFee = (dollars(50) * PLATFORM_FEE) / 10000;
        uint256 sellerAmount = dollars(50) - platformFee;

        vm.expectEmit(true, true, true, true);
        emit ProductPurchased(productId, buyer1, seller1, dollars(50), platformFee);

        mart.purchaseProduct(productId);
        vm.stopPrank();

        assertTrue(mart.hasUserPurchased(buyer1, productId));

        (,,,,, uint256 salesCount) = mart.getProduct(productId);
        assertEq(salesCount, 1);

        // sellers mapping returns: totalSales, balance, totalEarnings (productIds array is not returned)
        (uint256 totalSales, uint256 sellerBal, uint256 totalEarnings) = mart.sellers(seller1);
        assertEq(totalSales, 1);
        assertEq(sellerBal, sellerAmount);
        assertEq(totalEarnings, sellerAmount);
        assertEq(mart.platformBalance(), platformFee);
    }

    function test_PurchaseProduct_LowPriceItem() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest", cents(99), "Budget Item");

        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), cents(99));
        mart.purchaseProduct(productId);
        vm.stopPrank();

        uint256 platformFee = (cents(99) * PLATFORM_FEE) / 10000;
        uint256 sellerAmount = cents(99) - platformFee;

        (, uint256 sellerBal,) = mart.sellers(seller1);
        assertEq(sellerBal, sellerAmount);
    }

    function test_PurchaseProduct_MultipleBuyers() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(30), "Test Product");

        uint256 platformFee = (dollars(30) * PLATFORM_FEE) / 10000;
        uint256 sellerAmount = dollars(30) - platformFee;

        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), dollars(30));
        mart.purchaseProduct(productId);
        vm.stopPrank();

        vm.startPrank(buyer2);
        mneeToken.approve(address(mart), dollars(30));
        mart.purchaseProduct(productId);
        vm.stopPrank();

        assertTrue(mart.hasUserPurchased(buyer1, productId));
        assertTrue(mart.hasUserPurchased(buyer2, productId));

        (uint256 totalSales, uint256 sellerBal,) = mart.sellers(seller1);
        assertEq(totalSales, 2);
        assertEq(sellerBal, sellerAmount * 2);
    }

    function test_PurchaseProduct_RevertIf_ProductDoesNotExist() public {
        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), dollars(100));
        vm.expectRevert(abi.encodeWithSelector(MneeMart.ProductDoesNotExist.selector, 999));
        mart.purchaseProduct(999);
        vm.stopPrank();
    }

    function test_PurchaseProduct_RevertIf_ProductNotActive() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");

        vm.prank(seller1);
        mart.deactivateProduct(productId);

        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), dollars(50));
        vm.expectRevert(abi.encodeWithSelector(MneeMart.ProductNotActive.selector, productId));
        mart.purchaseProduct(productId);
        vm.stopPrank();
    }

    function test_PurchaseProduct_RevertIf_BuyingOwnProduct() public {
        vm.startPrank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");
        mneeToken.approve(address(mart), dollars(50));
        vm.expectRevert(MneeMart.CannotBuyOwnProduct.selector);
        mart.purchaseProduct(productId);
        vm.stopPrank();
    }

    function test_PurchaseProduct_RevertIf_AlreadyPurchased() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");

        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), dollars(100));
        mart.purchaseProduct(productId);

        vm.expectRevert(abi.encodeWithSelector(MneeMart.ProductAlreadyPurchased.selector, productId));
        mart.purchaseProduct(productId);
        vm.stopPrank();
    }

    // ==================== Withdraw Tests ====================

    function test_WithdrawSellerBalance_Success() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");

        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), dollars(50));
        mart.purchaseProduct(productId);
        vm.stopPrank();

        uint256 sellerAmount = (dollars(50) * (10000 - PLATFORM_FEE)) / 10000;
        uint256 balanceBefore = mneeToken.balanceOf(seller1);

        vm.prank(seller1);
        mart.withdrawSellerBalance();

        uint256 balanceAfter = mneeToken.balanceOf(seller1);
        assertEq(balanceAfter - balanceBefore, sellerAmount);
    }

    function test_WithdrawSellerBalance_RevertIf_NoBalance() public {
        vm.startPrank(seller1);
        vm.expectRevert(MneeMart.NoBalanceToWithdraw.selector);
        mart.withdrawSellerBalance();
        vm.stopPrank();
    }

    function test_WithdrawPlatformFees_Success() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(100), "Test Product");

        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), dollars(100));
        mart.purchaseProduct(productId);
        vm.stopPrank();

        uint256 platformFee = (dollars(100) * PLATFORM_FEE) / 10000;
        uint256 balanceBefore = mneeToken.balanceOf(owner);

        mart.withdrawPlatformFees();

        uint256 balanceAfter = mneeToken.balanceOf(owner);
        assertEq(balanceAfter - balanceBefore, platformFee);
    }

    function test_WithdrawPlatformFees_RevertIf_NotOwner() public {
        vm.startPrank(seller1);
        vm.expectRevert();
        mart.withdrawPlatformFees();
        vm.stopPrank();
    }

    function test_WithdrawPlatformFees_RevertIf_NoFees() public {
        vm.expectRevert(MneeMart.NoPlatformFeesToWithdraw.selector);
        mart.withdrawPlatformFees();
    }

    // ==================== Access Control Tests ====================

    function test_GetProductCID_SuccessForBuyer() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");

        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), dollars(50));
        mart.purchaseProduct(productId);

        string memory cid = mart.getProductCID(productId);
        assertEq(cid, "QmTest123");
        vm.stopPrank();
    }

    function test_GetProductCID_SuccessForSeller() public {
        vm.startPrank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");
        string memory cid = mart.getProductCID(productId);
        assertEq(cid, "QmTest123");
        vm.stopPrank();
    }

    function test_GetProductCID_RevertIf_AccessDenied() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");

        vm.startPrank(buyer1);
        vm.expectRevert(MneeMart.AccessDenied.selector);
        mart.getProductCID(productId);
        vm.stopPrank();
    }

    // ==================== Product Management Tests ====================

    function test_DeactivateProduct_Success() public {
        vm.startPrank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");
        mart.deactivateProduct(productId);

        (,,,, bool active,) = mart.getProduct(productId);
        assertFalse(active);
        vm.stopPrank();
    }

    function test_DeactivateProduct_RevertIf_NotSeller() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");

        vm.startPrank(seller2);
        vm.expectRevert(MneeMart.NotProductSeller.selector);
        mart.deactivateProduct(productId);
        vm.stopPrank();
    }

    function test_DeactivateProduct_RevertIf_AlreadyInactive() public {
        vm.startPrank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");
        mart.deactivateProduct(productId);

        vm.expectRevert(MneeMart.ProductAlreadyInactive.selector);
        mart.deactivateProduct(productId);
        vm.stopPrank();
    }

    function test_ActivateProduct_Success() public {
        vm.startPrank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");
        mart.deactivateProduct(productId);
        mart.activateProduct(productId);

        (,,,, bool active,) = mart.getProduct(productId);
        assertTrue(active);
        vm.stopPrank();
    }

    function test_ActivateProduct_RevertIf_AlreadyActive() public {
        vm.startPrank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");

        vm.expectRevert(MneeMart.ProductAlreadyActive.selector);
        mart.activateProduct(productId);
        vm.stopPrank();
    }

    function test_UpdateProductPrice_Success() public {
        vm.startPrank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");
        mart.updateProductPrice(productId, dollars(75));

        (,, uint256 price,,,) = mart.getProduct(productId);
        assertEq(price, dollars(75));
        vm.stopPrank();
    }

    function test_UpdateProductPrice_RevertIf_NotSeller() public {
        vm.prank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");

        vm.startPrank(seller2);
        vm.expectRevert(MneeMart.NotProductSeller.selector);
        mart.updateProductPrice(productId, dollars(75));
        vm.stopPrank();
    }

    function test_UpdateProductPrice_RevertIf_InvalidPrice() public {
        vm.startPrank(seller1);
        uint256 productId = mart.listProduct("QmTest123", dollars(50), "Test Product");

        vm.expectRevert(abi.encodeWithSelector(MneeMart.InvalidPrice.selector, 0));
        mart.updateProductPrice(productId, 0);
        vm.stopPrank();
    }

    // ==================== Platform Fee Tests ====================

    function test_UpdatePlatformFee_Success() public {
        mart.updatePlatformFee(1000);
        assertEq(mart.platformFeePercentage(), 1000);
    }

    function test_UpdatePlatformFee_RevertIf_FeeTooHigh() public {
        vm.expectRevert("Fee too high (max 20%)");
        mart.updatePlatformFee(2001);
    }

    // ==================== Integration Tests ====================

    function test_Integration_CompleteFlow() public {
        vm.startPrank(seller1);
        uint256 product1 = mart.listProduct("QmEbook", dollars(20), "E-Book");
        uint256 product2 = mart.listProduct("QmCourse", dollars(50), "Course");
        vm.stopPrank();

        vm.prank(seller2);
        uint256 product3 = mart.listProduct("QmTemplate", dollars(15), "Template");

        vm.startPrank(buyer1);
        mneeToken.approve(address(mart), dollars(35));
        mart.purchaseProduct(product1);
        mart.purchaseProduct(product3);
        vm.stopPrank();

        vm.startPrank(buyer2);
        mneeToken.approve(address(mart), dollars(50));
        mart.purchaseProduct(product2);
        vm.stopPrank();

        uint256 expectedSeller1 = ((dollars(20) + dollars(50)) * (10000 - PLATFORM_FEE)) / 10000;
        uint256 expectedSeller2 = (dollars(15) * (10000 - PLATFORM_FEE)) / 10000;

        vm.prank(seller1);
        mart.withdrawSellerBalance();

        vm.prank(seller2);
        mart.withdrawSellerBalance();

        mart.withdrawPlatformFees();
    }

    function testFuzz_PurchaseProduct_CalculateFees(uint256 price, uint256 feePercentage) public {
        vm.assume(price > 0 && price <= dollars(5000)); // Reasonable price limit
        vm.assume(feePercentage <= 2000);

        MneeMart customMart = new MneeMart(address(mneeToken), feePercentage);

        vm.prank(seller1);
        uint256 productId = customMart.listProduct("QmTest", price, "Product");

        vm.startPrank(buyer1);
        mneeToken.approve(address(customMart), price);
        customMart.purchaseProduct(productId);
        vm.stopPrank();

        uint256 expectedPlatformFee = (price * feePercentage) / 10000;
        uint256 expectedSellerAmount = price - expectedPlatformFee;

        assertEq(customMart.platformBalance(), expectedPlatformFee);
        (, uint256 sellerBalance,) = customMart.sellers(seller1);
        assertEq(sellerBalance, expectedSellerAmount);
    }
}
