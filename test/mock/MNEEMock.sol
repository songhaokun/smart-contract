// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MNEEToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("MNEE Stablecoin", "MNEE") Ownable(msg.sender) {
        // Mint initial supply to deployer
        _mint(msg.sender, initialSupply);
    }

    // Mint more tokens (owner only)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
