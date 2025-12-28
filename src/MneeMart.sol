//SPDX License Identifier:MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract MneeMart is Ownable(msg.sender), ReentrancyGuard
    {
    using SafeERC20 for IERC20;

    error Mart_NotOwner();
    error Mart_InvalidTokenAddress();
    error Mart_PlatformFeeTooHigh(uint256 provided, uint256 maxAllowed);
    error EmptyCID();
    error InvalidPrice(uint256 price);
    error EmptyName();
    error ProductDoesNotExist(uint256 productId);
    error ProductNotActive(uint256 productId);
    error CannotBuyOwnProduct();
    error ProductAlreadyPurchased(uint256 productId);
    error NoBalanceToWithdraw();
    error NoPlatformFeesToWithdraw();
    error AccessDenied();
    error NotProductSeller();
    error ProductAlreadyInactive();
    error ProductAlreadyActive();





    IERC20 public mneeToken;
    address public Martowner;
    uint256 public platformFeePercentage; // in basis points (100 = 1%)
    uint256 public productCounter;
    uint256 public platformBalance; // Accumulated platform fees
    
    struct Product {
        uint256 id;
        address seller;
        string cid; // IPFS CID
        uint256 price; // in MNEE tokens (with 18 decimals)
        string name;
        bool active;
        uint256 salesCount;
    }
    
    struct Seller {
        uint256[] productIds;
        uint256 totalSales;
        uint256 balance; // Withdrawable balance
        uint256 totalEarnings;
    }
    mapping(uint256 => Product) public products;
    mapping(address => Seller) public sellers;
    mapping(address => mapping(uint256 => bool)) public hasPurchased; // buyer => productId => purchased
    
    event ProductListed(uint256 indexed productId, address indexed seller, string cid, uint256 price);
    event ProductPurchased(uint256 indexed productId, address indexed buyer, address indexed seller, uint256 price, uint256 platformFee);
    event SellerWithdrawal(address indexed seller, uint256 amount);
    event PlatformWithdrawal(address indexed owner, uint256 amount);
    event ProductDeactivated(uint256 indexed productId);
    event ProductActivated(uint256 indexed productId);
    event ProductPriceUpdated(uint256 indexed productId, uint256 newPrice);
    event PlatformFeeUpdated(uint256 newFee);
    
    modifier onlyMartOwner() {
        if(msg.sender != Martowner)
        {
            revert Mart_NotOwner();
        }
        _;
    }
    constructor(address _mneeToken, uint256 _platformFeePercentage) {
        if (_mneeToken == address(0)) {
        revert Mart_InvalidTokenAddress();
        }

        if (_platformFeePercentage > 2000) {
        revert Mart_PlatformFeeTooHigh(_platformFeePercentage, 2000); //max 20%
        }

        mneeToken = IERC20(_mneeToken);
        Martowner = msg.sender;
        platformFeePercentage = _platformFeePercentage;
    }
    // List a new product (anyone can become a seller)
    function listProduct(
        string memory _cid,
        uint256 _price,
        string memory _name
    ) external returns (uint256) {
        if (bytes(_cid).length == 0) revert EmptyCID();
        if (_price == 0) revert InvalidPrice(_price);
        if (bytes(_name).length == 0) revert EmptyName();

        productCounter++;
        
        products[productCounter] = Product({
            id: productCounter,
            seller: msg.sender,
            cid: _cid,
            price: _price,
            name: _name,
            active: true,
            salesCount: 0
        });
        
        sellers[msg.sender].productIds.push(productCounter);
        
        emit ProductListed(productCounter, msg.sender, _cid, _price);
        
        return productCounter;
    }
    // Purchase a product with MNEE stablecoin
    function purchaseProduct(uint256 _productId) external nonReentrant
    {
    Product storage product = products[_productId];
    //checks
    if (product.id == 0) revert ProductDoesNotExist(_productId);
    if (!product.active) revert ProductNotActive(_productId);
    if (product.seller == msg.sender) revert CannotBuyOwnProduct();
    if (hasPurchased[msg.sender][_productId])revert ProductAlreadyPurchased(_productId);
    if (product.price == 0) revert InvalidPrice(0);

    uint256 platformFee =(product.price * platformFeePercentage) / 10000;
    uint256 sellerAmount = product.price - platformFee;

    // Effects

    // Update purchase records
    hasPurchased[msg.sender][_productId] = true;
    product.salesCount++;
    sellers[product.seller].totalSales++;

    // Update balances
    sellers[product.seller].totalEarnings += sellerAmount;
    sellers[product.seller].balance += sellerAmount;
    platformBalance += platformFee;

    // Interaction Transfer MNEE tokens from buyer to contract
    mneeToken.safeTransferFrom(
        msg.sender,
        address(this),
        product.price
    );

    emit ProductPurchased( _productId,msg.sender,product.seller,product.price,platformFee);
}

    
    // Seller withdraws their earnings
    function withdrawSellerBalance() external nonReentrant
{
    uint256 amount = sellers[msg.sender].balance;

    if (amount == 0) revert NoBalanceToWithdraw();

    sellers[msg.sender].balance = 0;
    mneeToken.safeTransfer(msg.sender, amount);

    emit SellerWithdrawal(msg.sender, amount);
}
    
    // Platform owner withdraws accumulated fees
    function withdrawPlatformFees() external onlyOwner {
        uint256 amount = platformBalance;
        require(amount > 0, "No platform fees to withdraw");
        
        platformBalance = 0;
        
        require(
            mneeToken.transfer(Martowner, amount),
            "MNEE withdrawal failed"
        );
        
        emit PlatformWithdrawal(Martowner, amount);
    }
    
    // Get product CID (only for buyers who purchased)
    function getProductCID(uint256 _productId)
    external
    view
    returns (string memory)
{
    Product storage product = products[_productId];

    if (product.id == 0) revert ProductDoesNotExist(_productId);

    if (
        !hasPurchased[msg.sender][_productId] &&
        product.seller != msg.sender
    ) {
        revert AccessDenied();
    }

    return product.cid;
}

    
    // Deactivate a product (seller only)
  function deactivateProduct(uint256 _productId) external {
    Product storage product = products[_productId];

    if (product.seller != msg.sender) revert NotProductSeller();
    if (!product.active) revert ProductAlreadyInactive();

    product.active = false;

    emit ProductDeactivated(_productId);
}

    
    // Activate a product (seller only)
    function activateProduct(uint256 _productId) external {
    Product storage product = products[_productId];

    if (product.seller != msg.sender) revert NotProductSeller();
    if (product.active) revert ProductAlreadyActive();

    product.active = true;

    emit ProductActivated(_productId);
}

    
    // Update product price (seller only)
   function updateProductPrice(uint256 _productId, uint256 _newPrice) external {
    Product storage product = products[_productId];

    if (product.seller != msg.sender) revert NotProductSeller();
    if (_newPrice == 0) revert InvalidPrice(_newPrice);

    product.price = _newPrice;

    emit ProductPriceUpdated(_productId, _newPrice);
}

    
    // Get seller's products
    function getSellerProducts(address _seller) external view returns (uint256[] memory) {
        return sellers[_seller].productIds;
    }
    
    
    // Check if user has purchased a product
    function hasUserPurchased(address _user, uint256 _productId) external view returns (bool) {
        return hasPurchased[_user][_productId];
    }
    
    // Get product details (without CID)
    function getProduct(uint256 _productId) external view returns (
        uint256 id,
        address seller,
        uint256 price,
        string memory name,
        bool active,
        uint256 salesCount
    ) {
        Product memory product = products[_productId];
        return (
            product.id,
            product.seller,
            product.price,
            product.name,
            product.active,
            product.salesCount
        );
    }
    

    }