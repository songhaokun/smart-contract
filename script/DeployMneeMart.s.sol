// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/MneeMart.sol";

contract DeployMneeMart is Script {
    function run() external {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Constructor params
        address mneeToken = vm.envAddress("MNEE_TOKEN");
        uint256 platformFeeBps = vm.envUint("PLATFORM_FEE_BPS"); // e.g. 500 = 5%

        vm.startBroadcast(deployerPrivateKey);

        MneeMart mart = new MneeMart(mneeToken, platformFeeBps);

        vm.stopBroadcast();

        console2.log("MneeMart deployed at:", address(mart));
        console2.log("Owner:", mart.owner());
        console2.log("Platform Fee (bps):", mart.platformFeePercentage());
    }
}
