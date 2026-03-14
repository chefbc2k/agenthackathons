// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {PaymentJobRegistry} from "../src/PaymentJobRegistry.sol";

contract PaymentJobRegistryTest is Test {
    PaymentJobRegistry internal registry;
    address internal owner = address(0xA11CE);
    address internal settlementReceiver = address(0xBEEF);

    function setUp() public {
        vm.deal(owner, 10 ether);
        registry = new PaymentJobRegistry(owner, settlementReceiver);
    }

    function testCreatePaymentJobEmitsEscrowedState() public {
        vm.prank(owner);
        uint256 jobId = registry.createPaymentJob{value: 1 ether}(
            keccak256("job"), block.timestamp + 1 days, true
        );

        PaymentJobRegistry.PaymentJob memory job = registry.getPaymentJob(jobId);
        assertEq(uint256(job.status), uint256(PaymentJobRegistry.JobStatus.Created));
        assertEq(job.escrowAmount, 1 ether);
        assertTrue(job.escrowRequired);
    }

    function testCreatePaymentJobRevertsWithoutEscrowWhenRequired() public {
        vm.prank(owner);
        vm.expectRevert(PaymentJobRegistry.EscrowRequired.selector);
        registry.createPaymentJob(keccak256("job"), block.timestamp + 1 days, true);
    }

    function testHappyPathReleasesEscrowToSettlementReceiver() public {
        vm.prank(owner);
        uint256 jobId = registry.createPaymentJob{value: 1 ether}(
            keccak256("job"), block.timestamp + 1 days, true
        );

        vm.startPrank(owner);
        registry.acceptPaymentJob(jobId);
        registry.submitPaymentReceipt(jobId, keccak256("receipt"));
        registry.markCompleted(jobId);
        vm.stopPrank();

        PaymentJobRegistry.PaymentJob memory job = registry.getPaymentJob(jobId);
        assertEq(uint256(job.status), uint256(PaymentJobRegistry.JobStatus.Completed));
        assertEq(job.escrowAmount, 0);
        assertEq(settlementReceiver.balance, 1 ether);
    }

    function testMarkFailedRefundsEscrowToOwner() public {
        vm.prank(owner);
        uint256 jobId = registry.createPaymentJob{value: 1 ether}(
            keccak256("job"), block.timestamp + 1 days, true
        );

        vm.startPrank(owner);
        registry.acceptPaymentJob(jobId);
        registry.markFailed(jobId, keccak256("provider_error"));
        vm.stopPrank();

        PaymentJobRegistry.PaymentJob memory job = registry.getPaymentJob(jobId);
        assertEq(uint256(job.status), uint256(PaymentJobRegistry.JobStatus.Failed));
        assertEq(job.escrowAmount, 0);
        assertEq(owner.balance, 10 ether);
    }

    function testCancelBeforeAcceptRefundsEscrow() public {
        vm.prank(owner);
        uint256 jobId = registry.createPaymentJob{value: 0.5 ether}(
            keccak256("job"), block.timestamp + 1 days, true
        );

        vm.prank(owner);
        registry.cancelPaymentJob(jobId);

        PaymentJobRegistry.PaymentJob memory job = registry.getPaymentJob(jobId);
        assertEq(uint256(job.status), uint256(PaymentJobRegistry.JobStatus.Cancelled));
        assertEq(owner.balance, 10 ether);
    }

    function testExpireAfterDeadlineRefundsEscrow() public {
        vm.prank(owner);
        uint256 jobId = registry.createPaymentJob{value: 0.5 ether}(
            keccak256("job"), block.timestamp + 1 days, true
        );

        vm.warp(block.timestamp + 2 days);

        vm.prank(owner);
        registry.expirePaymentJob(jobId);

        PaymentJobRegistry.PaymentJob memory job = registry.getPaymentJob(jobId);
        assertEq(uint256(job.status), uint256(PaymentJobRegistry.JobStatus.Expired));
        assertEq(owner.balance, 10 ether);
    }

    function testSubmitMessageCheckpointOnlyWhileActive() public {
        vm.prank(owner);
        uint256 jobId = registry.createPaymentJob{value: 0.5 ether}(
            keccak256("job"), block.timestamp + 1 days, true
        );

        vm.prank(owner);
        registry.submitMessageCheckpoint(jobId, keccak256("checkpoint"));

        vm.startPrank(owner);
        registry.acceptPaymentJob(jobId);
        registry.submitPaymentReceipt(jobId, keccak256("receipt"));
        registry.markCompleted(jobId);
        vm.expectRevert(PaymentJobRegistry.InvalidStatus.selector);
        registry.submitMessageCheckpoint(jobId, keccak256("late-checkpoint"));
        vm.stopPrank();
    }
}
