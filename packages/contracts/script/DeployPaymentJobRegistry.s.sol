// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {console2} from "forge-std/console2.sol";
import {Script} from "forge-std/Script.sol";

import {PaymentJobRegistry} from "../src/PaymentJobRegistry.sol";

contract DeployPaymentJobRegistry is Script {
    function run() external returns (PaymentJobRegistry deployed) {
        address owner = vm.envAddress("PAYMENT_JOB_REGISTRY_OWNER");
        address settlementReceiver = vm.envAddress("PAYMENT_JOB_REGISTRY_SETTLEMENT_RECEIVER");

        vm.startBroadcast();
        deployed = new PaymentJobRegistry(owner, settlementReceiver);
        vm.stopBroadcast();

        console2.log("PaymentJobRegistry deployed at", address(deployed));
        console2.log("PaymentJobRegistry owner", owner);
        console2.log("PaymentJobRegistry settlementReceiver", settlementReceiver);
    }
}
