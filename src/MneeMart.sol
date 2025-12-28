//SPDX License Identifier:MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MneeMart is Ownable(msg.sender), ReentrancyGuard
    {
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
        string description;
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
    mapping(uint256 => address[]) public productPurchasers; // productId => buyers array
    
    modifier onlyMartOwner() {
        require(msg.sender == Martowner, "Only owner can call this");
        _;
    }
    constructor(address _mneeToken, uint256 _platformFeePercentage) {
        require(_mneeToken != address(0), "Invalid token address");
        require(_platformFeePercentage <= 2000, "Fee too high (max 20%)"); // Max 20%
        
        mneeToken = IERC20(_mneeToken);
        Martowner = msg.sender;
        platformFeePercentage = _platformFeePercentage;
        productCounter = 0;
        platformBalance = 0;
    }
    

    }