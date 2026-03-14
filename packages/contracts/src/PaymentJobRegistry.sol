// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";

contract PaymentJobRegistry is Ownable, ReentrancyGuard {
    enum JobStatus {
        None,
        Created,
        Accepted,
        ReceiptSubmitted,
        Completed,
        Failed,
        Cancelled,
        Expired
    }

    struct PaymentJob {
        bytes32 jobHash;
        bytes32 receiptHash;
        bytes32 failureReasonHash;
        uint64 deadline;
        uint96 escrowAmount;
        bool escrowRequired;
        JobStatus status;
        address requester;
    }

    uint256 public nextJobId = 1;
    address public immutable settlementReceiver;
    mapping(uint256 => PaymentJob) private paymentJobs;

    event PaymentJobCreated(
        uint256 indexed jobId,
        bytes32 indexed jobHash,
        address indexed requester,
        uint256 deadline,
        bool escrowRequired,
        uint256 escrowAmount
    );
    event MessageCheckpointSubmitted(uint256 indexed jobId, bytes32 indexed checkpointHash);
    event PaymentJobAccepted(uint256 indexed jobId);
    event PaymentReceiptSubmitted(uint256 indexed jobId, bytes32 indexed receiptHash);
    event PaymentJobCompleted(uint256 indexed jobId, uint256 releasedAmount);
    event PaymentJobFailed(uint256 indexed jobId, bytes32 indexed reasonHash, uint256 refundedAmount);
    event PaymentJobCancelled(uint256 indexed jobId, uint256 refundedAmount);
    event PaymentJobExpired(uint256 indexed jobId, uint256 refundedAmount);

    error EscrowRequired();
    error InvalidStatus();
    error DeadlineInPast();
    error DeadlineNotReached();
    error UnknownJob();

    constructor(address initialOwner, address initialSettlementReceiver) Ownable(initialOwner) {
        settlementReceiver = initialSettlementReceiver;
    }

    function createPaymentJob(bytes32 jobHash, uint256 deadline, bool escrowRequired)
        external
        payable
        onlyOwner
        returns (uint256 jobId)
    {
        if (deadline <= block.timestamp) {
            revert DeadlineInPast();
        }
        if (escrowRequired && msg.value == 0) {
            revert EscrowRequired();
        }

        jobId = nextJobId++;
        paymentJobs[jobId] = PaymentJob({
            jobHash: jobHash,
            receiptHash: bytes32(0),
            failureReasonHash: bytes32(0),
            deadline: uint64(deadline),
            escrowAmount: uint96(msg.value),
            escrowRequired: escrowRequired,
            status: JobStatus.Created,
            requester: owner()
        });

        emit PaymentJobCreated(jobId, jobHash, owner(), deadline, escrowRequired, msg.value);
    }

    function submitMessageCheckpoint(uint256 jobId, bytes32 checkpointHash) external onlyOwner {
        PaymentJob storage job = _getExistingJob(jobId);
        if (
            job.status != JobStatus.Created && job.status != JobStatus.Accepted
                && job.status != JobStatus.ReceiptSubmitted
        ) {
            revert InvalidStatus();
        }

        emit MessageCheckpointSubmitted(jobId, checkpointHash);
    }

    function acceptPaymentJob(uint256 jobId) external onlyOwner {
        PaymentJob storage job = _getExistingJob(jobId);
        if (job.status != JobStatus.Created) {
            revert InvalidStatus();
        }

        job.status = JobStatus.Accepted;
        emit PaymentJobAccepted(jobId);
    }

    function submitPaymentReceipt(uint256 jobId, bytes32 receiptHash) external onlyOwner {
        PaymentJob storage job = _getExistingJob(jobId);
        if (job.status != JobStatus.Accepted) {
            revert InvalidStatus();
        }

        job.receiptHash = receiptHash;
        job.status = JobStatus.ReceiptSubmitted;
        emit PaymentReceiptSubmitted(jobId, receiptHash);
    }

    function markCompleted(uint256 jobId) external onlyOwner nonReentrant {
        PaymentJob storage job = _getExistingJob(jobId);
        if (job.status != JobStatus.ReceiptSubmitted) {
            revert InvalidStatus();
        }

        uint256 escrowAmount = job.escrowAmount;
        job.escrowAmount = 0;
        job.status = JobStatus.Completed;

        if (escrowAmount > 0) {
            payable(settlementReceiver).transfer(escrowAmount);
        }

        emit PaymentJobCompleted(jobId, escrowAmount);
    }

    function markFailed(uint256 jobId, bytes32 reasonHash) external onlyOwner nonReentrant {
        PaymentJob storage job = _getExistingJob(jobId);
        if (job.status != JobStatus.Accepted && job.status != JobStatus.ReceiptSubmitted) {
            revert InvalidStatus();
        }

        uint256 escrowAmount = job.escrowAmount;
        job.escrowAmount = 0;
        job.failureReasonHash = reasonHash;
        job.status = JobStatus.Failed;

        if (escrowAmount > 0) {
            payable(owner()).transfer(escrowAmount);
        }

        emit PaymentJobFailed(jobId, reasonHash, escrowAmount);
    }

    function cancelPaymentJob(uint256 jobId) external onlyOwner nonReentrant {
        PaymentJob storage job = _getExistingJob(jobId);
        if (job.status != JobStatus.Created) {
            revert InvalidStatus();
        }

        uint256 escrowAmount = job.escrowAmount;
        job.escrowAmount = 0;
        job.status = JobStatus.Cancelled;

        if (escrowAmount > 0) {
            payable(owner()).transfer(escrowAmount);
        }

        emit PaymentJobCancelled(jobId, escrowAmount);
    }

    function expirePaymentJob(uint256 jobId) external onlyOwner nonReentrant {
        PaymentJob storage job = _getExistingJob(jobId);
        if (
            job.status != JobStatus.Created && job.status != JobStatus.Accepted
                && job.status != JobStatus.ReceiptSubmitted
        ) {
            revert InvalidStatus();
        }
        if (block.timestamp < job.deadline) {
            revert DeadlineNotReached();
        }

        uint256 escrowAmount = job.escrowAmount;
        job.escrowAmount = 0;
        job.status = JobStatus.Expired;

        if (escrowAmount > 0) {
            payable(owner()).transfer(escrowAmount);
        }

        emit PaymentJobExpired(jobId, escrowAmount);
    }

    function getPaymentJob(uint256 jobId) external view returns (PaymentJob memory) {
        return _getExistingJob(jobId);
    }

    function _getExistingJob(uint256 jobId) internal view returns (PaymentJob storage job) {
        job = paymentJobs[jobId];
        if (job.status == JobStatus.None) {
            revert UnknownJob();
        }
    }
}
