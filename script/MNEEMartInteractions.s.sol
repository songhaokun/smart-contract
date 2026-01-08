// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/MneeMart.sol";
import "../test/mock/MNEEMock.sol";

contract MneeMartFlowScript is Script {
    MneeMart public mart;
    MNEEToken public mneeToken;

    // Addresses
    address public owner;
    address public seller1;
    address public seller2;
    address public buyer1;
    address public buyer2;

    // Platform fee: 5%
    uint256 public constant PLATFORM_FEE = 500;

    // Helper functions
    function dollars(uint256 amount) internal pure returns (uint256) {
        return amount * 1e18;
    }

    function cents(uint256 amount) internal pure returns (uint256) {
        return (amount * 1e18) / 100;
    }

    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        owner = vm.addr(deployerPrivateKey);

        console.log("=================================================");
        console.log("MneeMart Complete Flow Script");
        console.log("=================================================");
        console.log("Owner Address:", owner);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ============================================
        // STEP 1: Deploy MNEE Token
        // ============================================
        console.log("Step 1: Deploying MNEE Token...");
        mneeToken = new MNEEToken(1_000_000e18);

        console.log("MNEE Token deployed at:", address(mneeToken));
        console.log("");

        // ============================================
        // STEP 2: Deploy MneeMart Contract
        // ============================================
        console.log("Step 2: Deploying MneeMart Contract...");
        mart = new MneeMart(address(mneeToken), PLATFORM_FEE);
        console.log("MneeMart deployed at:", address(mart));
        console.log("Platform Fee:", PLATFORM_FEE, "basis points (5%)");
        console.log("");

        // ============================================
        // STEP 3: Setup Test Accounts
        // ============================================
        console.log("Step 3: Setting up test accounts...");

        // --- NEW: Use real private keys from environment ---
        uint256 seller1PrivateKey = vm.envUint("SELLER1_PRIVATE_KEY");
        uint256 seller2PrivateKey = vm.envUint("SELLER2_PRIVATE_KEY");
        uint256 buyer1PrivateKey = vm.envUint("BUYER1_PRIVATE_KEY");
        uint256 buyer2PrivateKey = vm.envUint("BUYER2_PRIVATE_KEY");

        seller1 = vm.addr(seller1PrivateKey);
        seller2 = vm.addr(seller2PrivateKey);
        buyer1 = vm.addr(buyer1PrivateKey);
        buyer2 = vm.addr(buyer2PrivateKey);
        // --- END NEW SECTION ---

        console.log("Seller 1:", seller1);
        console.log("Seller 2:", seller2);
        console.log("Buyer 1:", buyer1);
        console.log("Buyer 2:", buyer2);
        console.log("");

        // Mint tokens to all participants
        console.log("Minting MNEE tokens to participants...");
        mneeToken.mint(seller1, dollars(10000)); // $10,000
        mneeToken.mint(seller2, dollars(10000)); // $10,000
        mneeToken.mint(buyer1, dollars(10000)); // $10,000
        mneeToken.mint(buyer2, dollars(10000)); // $10,000

        console.log("Each participant received: 10,000 MNEE ($10,000)");
        console.log("");

        vm.stopBroadcast();

        // ============================================
        // STEP 4: Sellers List Products
        // ============================================
        console.log("Step 4: Sellers listing products...");
        console.log("");

        // Seller 1 lists products
        vm.startBroadcast(seller1PrivateKey);

        console.log("Seller 1 listing products:");
        uint256 product1 = mart.listProduct("QmEbook12345", dollars(20), "Complete Solidity Guide");
        console.log("  - Product ID:", product1);
        console.log("    Name: Complete Solidity Guide");
        console.log("    Price: $20.00");
        console.log("    CID: QmEbook12345");

        uint256 product2 = mart.listProduct("QmCourse67890", dollars(99), "Web3 Development Masterclass");
        console.log("  - Product ID:", product2);
        console.log("    Name: Web3 Development Masterclass");
        console.log("    Price: $99.00");
        console.log("    CID: QmCourse67890");

        vm.stopBroadcast();
        console.log("");

        // Seller 2 lists products
        vm.startBroadcast(seller2PrivateKey);

        console.log("Seller 2 listing products:");
        uint256 product3 = mart.listProduct("QmTemplate111", cents(1999), "NFT Marketplace Template");
        console.log("  - Product ID:", product3);
        console.log("    Name: NFT Marketplace Template");
        console.log("    Price: $19.99");
        console.log("    CID: QmTemplate111");

        uint256 product4 = mart.listProduct("QmAudio222", cents(499), "Royalty-Free Music Pack");
        console.log("  - Product ID:", product4);
        console.log("    Name: Royalty-Free Music Pack");
        console.log("    Price: $4.99");
        console.log("    CID: QmAudio222");

        vm.stopBroadcast();
        console.log("");

        // ============================================
        // STEP 5: Display Marketplace Inventory
        // ============================================
        console.log("Step 5: Current Marketplace Inventory");
        console.log("--------------------------------------");
        displayProductDetails(product1);
        displayProductDetails(product2);
        displayProductDetails(product3);
        displayProductDetails(product4);
        console.log("");

        // ============================================
        // STEP 6: Buyers Purchase Products
        // ============================================
        console.log("Step 6: Buyers purchasing products...");
        console.log("");

        // Buyer 1 purchases from Seller 1
        vm.startBroadcast(buyer1PrivateKey);

        console.log("Buyer 1 purchasing:");
        mneeToken.approve(address(mart), dollars(20));
        mart.purchaseProduct(product1);
        console.log("  - Purchased: Complete Solidity Guide ($20.00)");

        vm.stopBroadcast();

        // Buyer 2 purchases from both sellers
        vm.startBroadcast(buyer2PrivateKey);

        console.log("Buyer 2 purchasing:");
        mneeToken.approve(address(mart), dollars(99));
        mart.purchaseProduct(product2);
        console.log("  - Purchased: Web3 Development Masterclass ($99.00)");

        mneeToken.approve(address(mart), cents(1999));
        mart.purchaseProduct(product3);
        console.log("  - Purchased: NFT Marketplace Template ($19.99)");

        vm.stopBroadcast();

        // Buyer 1 purchases another product
        vm.startBroadcast(buyer1PrivateKey);

        mneeToken.approve(address(mart), cents(499));
        mart.purchaseProduct(product4);
        console.log("Buyer 1 purchasing:");
        console.log("  - Purchased: Royalty-Free Music Pack ($4.99)");

        vm.stopBroadcast();
        console.log("");

        // ============================================
        // STEP 7: Display Sales Statistics
        // ============================================
        console.log("Step 7: Sales Statistics");
        console.log("------------------------");
        displayProductDetails(product1);
        displayProductDetails(product2);
        displayProductDetails(product3);
        displayProductDetails(product4);
        console.log("");

        // ============================================
        // STEP 8: Display Seller Earnings
        // ============================================
        console.log("Step 8: Seller Earnings (Before Withdrawal)");
        console.log("-------------------------------------------");
        displaySellerEarnings(seller1, "Seller 1");
        displaySellerEarnings(seller2, "Seller 2");

        console.log("Platform Balance: $", formatPrice(mart.platformBalance()));
        console.log("");

        // ============================================
        // STEP 9: Seller 1 Withdraws Earnings
        // ============================================
        console.log("Step 9: Seller 1 withdrawing earnings...");

        uint256 seller1BalanceBefore = mneeToken.balanceOf(seller1);

        vm.startBroadcast(seller1PrivateKey);
        mart.withdrawSellerBalance();
        vm.stopBroadcast();

        uint256 seller1BalanceAfter = mneeToken.balanceOf(seller1);
        uint256 withdrawn = seller1BalanceAfter - seller1BalanceBefore;

        console.log("Seller 1 withdrew: $", formatPrice(withdrawn));
        console.log("Seller 1 new MNEE balance: $", formatPrice(seller1BalanceAfter));
        console.log("");

        // ============================================
        // STEP 10: Update Product Price
        // ============================================
        console.log("Step 10: Seller 1 updating product price...");

        vm.startBroadcast(seller1PrivateKey);
        mart.updateProductPrice(product1, dollars(25));
        vm.stopBroadcast();

        console.log("Product 1 price updated: $20.00 -> $25.00");
        displayProductDetails(product1);
        console.log("");

        // ============================================
        // STEP 11: Deactivate / Reactivate Product
        // ============================================
        console.log("Step 11: Seller 2 deactivating product...");

        vm.startBroadcast(seller2PrivateKey);
        mart.deactivateProduct(product4);
        vm.stopBroadcast();

        console.log("Product 4 deactivated");
        displayProductDetails(product4);

        console.log("Seller 2 reactivating product...");

        vm.startBroadcast(seller2PrivateKey);
        mart.activateProduct(product4);
        vm.stopBroadcast();

        console.log("Product 4 reactivated");
        displayProductDetails(product4);
        console.log("");

        // ============================================
        // STEP 12: Seller 2 Withdraws Earnings
        // ============================================
        console.log("Step 12: Seller 2 withdrawing earnings...");

        uint256 seller2BalanceBefore = mneeToken.balanceOf(seller2);

        vm.startBroadcast(seller2PrivateKey);
        mart.withdrawSellerBalance();
        vm.stopBroadcast();

        uint256 seller2BalanceAfter = mneeToken.balanceOf(seller2);
        withdrawn = seller2BalanceAfter - seller2BalanceBefore;

        console.log("Seller 2 withdrew: $", formatPrice(withdrawn));
        console.log("Seller 2 new MNEE balance: $", formatPrice(seller2BalanceAfter));
        console.log("");

        // ============================================
        // STEP 13: Owner Withdraws Platform Fees
        // ============================================
        console.log("Step 13: Owner withdrawing platform fees...");

        uint256 platformBalance = mart.platformBalance();
        uint256 ownerBalanceBefore = mneeToken.balanceOf(owner);

        vm.startBroadcast(owner);
        mart.withdrawPlatformFees();
        vm.stopBroadcast();

        uint256 ownerBalanceAfter = mneeToken.balanceOf(owner);

        console.log("Platform fees collected: $", formatPrice(platformBalance));
        console.log("Owner new MNEE balance: $", formatPrice(ownerBalanceAfter));
        console.log("");

        // ============================================
        // STEP 14: Final Summary
        // ============================================
        console.log("Step 14: Final Summary");
        console.log("======================");
        console.log("");

        console.log("Total Products Listed: 4");
        console.log("Total Sales: 4");
        console.log("");

        console.log("Seller Balances (After Withdrawal):");
        displaySellerEarnings(seller1, "Seller 1");
        displaySellerEarnings(seller2, "Seller 2");
        console.log("");

        console.log("Token Balances:");
        console.log("  Owner:", formatPrice(mneeToken.balanceOf(owner)), "MNEE");
        console.log("  Seller 1:", formatPrice(mneeToken.balanceOf(seller1)), "MNEE");
        console.log("  Seller 2:", formatPrice(mneeToken.balanceOf(seller2)), "MNEE");
        console.log("  Buyer 1:", formatPrice(mneeToken.balanceOf(buyer1)), "MNEE");
        console.log("  Buyer 2:", formatPrice(mneeToken.balanceOf(buyer2)), "MNEE");
        console.log("");

        console.log("Platform Balance:", formatPrice(mart.platformBalance()), "MNEE");
        console.log("");

        // ============================================
        // STEP 15: Verify Access Control
        // ============================================
        console.log("Step 15: Verifying access control...");
        console.log("");

        // Buyer 1 access
        console.log("Buyer 1 purchased products:");
        vm.startBroadcast(buyer1PrivateKey);

        string memory cid1 = mart.getProductCID(product1);
        console.log("  - Product 1 CID:", cid1);

        string memory cid4 = mart.getProductCID(product4);
        console.log("  - Product 4 CID:", cid4);

        vm.stopBroadcast();

        // Buyer 2 access
        console.log("Buyer 2 purchased products:");
        vm.startBroadcast(buyer2PrivateKey);

        string memory cid2 = mart.getProductCID(product2);
        console.log("  - Product 2 CID:", cid2);

        string memory cid3 = mart.getProductCID(product3);
        console.log("  - Product 3 CID:", cid3);

        vm.stopBroadcast();
        console.log("");

        console.log("=================================================");
        console.log("MneeMart Flow Completed Successfully!");
        console.log("=================================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  MNEE Token:", address(mneeToken));
        console.log("  MneeMart:", address(mart));
        console.log("");
    }

    // Helper function to display product details
    function displayProductDetails(uint256 productId) internal view {
        (uint256 id, address seller, uint256 price, string memory name, bool active, uint256 salesCount) =
            mart.getProduct(productId);

        console.log("Product ID:", id);
        console.log("  Name:", name);
        console.log("  Price: $", formatPrice(price));
        console.log("  Seller:", seller);
        console.log("  Active:", active);
        console.log("  Sales Count:", salesCount);
    }

    // Helper function to display seller earnings
    function displaySellerEarnings(address seller, string memory label) internal view {
        (uint256 totalSales, uint256 balance, uint256 totalEarnings) = mart.sellers(seller);

        console.log(label);
        console.log("  Total Sales:", totalSales);
        console.log("  Current Balance: $", formatPrice(balance));
        console.log("  Total Earnings: $", formatPrice(totalEarnings));
    }

    // Format price for display (convert wei to dollar amount)
    function formatPrice(uint256 amount) internal pure returns (string memory) {
        uint256 dollars = amount / 1e18;
        uint256 cents = (amount % 1e18) * 100 / 1e18;

        if (cents < 10) {
            return string(abi.encodePacked(vm.toString(dollars), ".0", vm.toString(cents)));
        } else {
            return string(abi.encodePacked(vm.toString(dollars), ".", vm.toString(cents)));
        }
    }
}
