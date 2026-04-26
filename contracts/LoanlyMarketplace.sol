// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title LoanlyMarketplace
 * @notice Factory + escrow registry for SMB funding campaigns. Each campaign
 *         is a struct keyed by a bytes32 id (typically keccak256 of the off-chain
 *         UUID). Lifecycle: Open -> Funded (auto on target hit) -> Repaying ->
 *         Repaid. Cancellable while Open; auto-cancellable past the deadline.
 *
 *         The contract is custodial-friendly: `operator` is the platform key,
 *         so end-users never touch crypto. All investor / borrower addresses
 *         are still real EVM accounts that the platform signs for.
 */
contract LoanlyMarketplace {
    enum Status {
        None,
        Open,
        Funded,
        Repaying,
        Repaid,
        Cancelled
    }

    struct CampaignView {
        address borrower;
        uint256 target;
        uint16 interestBps;
        uint32 durationDays;
        uint64 commitDeadline;
        uint64 fundedAt;
        uint64 repaidAt;
        uint64 createdAt;
        uint256 totalCommitted;
        uint256 totalRepaid;
        Status status;
        uint256 investorCount;
    }

    struct Campaign {
        address borrower;
        uint256 target;
        uint16 interestBps;
        uint32 durationDays;
        uint64 commitDeadline;
        uint64 fundedAt;
        uint64 repaidAt;
        uint64 createdAt;
        uint256 totalCommitted;
        uint256 totalRepaid;
        Status status;
        address[] investors;
        mapping(address => uint256) commitment;
        mapping(address => uint256) repaidTo;
    }

    address public immutable operator;
    address public immutable token;

    mapping(bytes32 => Campaign) private campaigns;

    event CampaignCreated(
        bytes32 indexed id,
        address indexed borrower,
        uint256 target,
        uint16 interestBps,
        uint32 durationDays,
        uint64 commitDeadline
    );
    event Committed(
        bytes32 indexed id,
        address indexed investor,
        uint256 amount,
        uint256 totalCommitted
    );
    event Funded(bytes32 indexed id, address indexed borrower, uint256 amount);
    event RepaymentReceived(
        bytes32 indexed id,
        uint256 amount,
        uint256 totalRepaid
    );
    event InvestorPaid(
        bytes32 indexed id,
        address indexed investor,
        uint256 amount
    );
    event InvestorRefunded(
        bytes32 indexed id,
        address indexed investor,
        uint256 amount
    );
    event Repaid(bytes32 indexed id, uint256 totalRepaid);
    event Cancelled(bytes32 indexed id);

    error NotOperator();
    error NotBorrower();
    error Unauthorized();
    error AlreadyExists();
    error InvalidStatus();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error ZeroAmount();
    error ExceedsRemaining();
    error TransferFailed();

    constructor(address operator_, address token_) {
        operator = operator_;
        token = token_;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    // ── Operator: lifecycle init ─────────────────────────────────────────────

    function createCampaign(
        bytes32 id,
        address borrower,
        uint256 target,
        uint16 interestBps,
        uint32 durationDays,
        uint64 commitDeadline
    ) external onlyOperator {
        Campaign storage c = campaigns[id];
        if (c.status != Status.None) revert AlreadyExists();
        if (target == 0) revert ZeroAmount();

        c.borrower = borrower;
        c.target = target;
        c.interestBps = interestBps;
        c.durationDays = durationDays;
        c.commitDeadline = commitDeadline;
        c.createdAt = uint64(block.timestamp);
        c.status = Status.Open;

        emit CampaignCreated(
            id,
            borrower,
            target,
            interestBps,
            durationDays,
            commitDeadline
        );
    }

    // ── Investor: commit funds ───────────────────────────────────────────────

    function commit(bytes32 id, uint256 amount) external {
        Campaign storage c = campaigns[id];
        if (c.status != Status.Open) revert InvalidStatus();
        if (block.timestamp > c.commitDeadline) revert DeadlinePassed();
        if (amount == 0) revert ZeroAmount();

        uint256 remaining = c.target - c.totalCommitted;
        if (amount > remaining) revert ExceedsRemaining();

        if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }

        if (c.commitment[msg.sender] == 0) {
            c.investors.push(msg.sender);
        }
        c.commitment[msg.sender] += amount;
        c.totalCommitted += amount;

        emit Committed(id, msg.sender, amount, c.totalCommitted);

        if (c.totalCommitted == c.target) {
            c.status = Status.Funded;
            c.fundedAt = uint64(block.timestamp);
            if (!IERC20(token).transfer(c.borrower, c.totalCommitted)) {
                revert TransferFailed();
            }
            emit Funded(id, c.borrower, c.totalCommitted);
        }
    }

    // ── Borrower: repay ──────────────────────────────────────────────────────

    function repay(bytes32 id, uint256 amount) external {
        Campaign storage c = campaigns[id];
        if (c.status != Status.Funded && c.status != Status.Repaying) {
            revert InvalidStatus();
        }
        if (msg.sender != c.borrower) revert NotBorrower();
        if (amount == 0) revert ZeroAmount();

        uint256 totalOwed = _owed(c);
        uint256 remaining = totalOwed - c.totalRepaid;
        if (amount > remaining) {
            amount = remaining;
        }

        if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }

        c.totalRepaid += amount;

        uint256 n = c.investors.length;
        uint256 distributed;
        for (uint256 i = 0; i < n; i++) {
            address inv = c.investors[i];
            uint256 share;
            if (i == n - 1) {
                share = amount - distributed;
            } else {
                share = (amount * c.commitment[inv]) / c.totalCommitted;
                distributed += share;
            }
            if (share > 0) {
                c.repaidTo[inv] += share;
                if (!IERC20(token).transfer(inv, share)) revert TransferFailed();
                emit InvestorPaid(id, inv, share);
            }
        }

        if (c.totalRepaid >= totalOwed) {
            c.status = Status.Repaid;
            c.repaidAt = uint64(block.timestamp);
            emit Repaid(id, c.totalRepaid);
        } else {
            c.status = Status.Repaying;
            emit RepaymentReceived(id, amount, c.totalRepaid);
        }
    }

    // ── Cancel paths ─────────────────────────────────────────────────────────

    function cancel(bytes32 id) external {
        Campaign storage c = campaigns[id];
        if (c.status != Status.Open) revert InvalidStatus();
        if (msg.sender != c.borrower && msg.sender != operator) {
            revert Unauthorized();
        }
        _refundAll(id, c);
        c.status = Status.Cancelled;
        emit Cancelled(id);
    }

    function expireIfStale(bytes32 id) external {
        Campaign storage c = campaigns[id];
        if (c.status != Status.Open) revert InvalidStatus();
        if (block.timestamp <= c.commitDeadline) revert DeadlineNotPassed();
        _refundAll(id, c);
        c.status = Status.Cancelled;
        emit Cancelled(id);
    }

    function _refundAll(bytes32 id, Campaign storage c) internal {
        uint256 n = c.investors.length;
        for (uint256 i = 0; i < n; i++) {
            address inv = c.investors[i];
            uint256 amt = c.commitment[inv];
            if (amt > 0) {
                c.commitment[inv] = 0;
                if (!IERC20(token).transfer(inv, amt)) revert TransferFailed();
                emit InvestorRefunded(id, inv, amt);
            }
        }
        c.totalCommitted = 0;
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getCampaign(bytes32 id) external view returns (CampaignView memory v) {
        Campaign storage c = campaigns[id];
        v = CampaignView({
            borrower: c.borrower,
            target: c.target,
            interestBps: c.interestBps,
            durationDays: c.durationDays,
            commitDeadline: c.commitDeadline,
            fundedAt: c.fundedAt,
            repaidAt: c.repaidAt,
            createdAt: c.createdAt,
            totalCommitted: c.totalCommitted,
            totalRepaid: c.totalRepaid,
            status: c.status,
            investorCount: c.investors.length
        });
    }

    function getInvestors(bytes32 id) external view returns (address[] memory) {
        return campaigns[id].investors;
    }

    function getCommitment(bytes32 id, address investor) external view returns (uint256) {
        return campaigns[id].commitment[investor];
    }

    function getRepaidTo(bytes32 id, address investor) external view returns (uint256) {
        return campaigns[id].repaidTo[investor];
    }

    function owed(bytes32 id) external view returns (uint256) {
        return _owed(campaigns[id]);
    }

    function _owed(Campaign storage c) internal view returns (uint256) {
        return c.target + (c.target * c.interestBps) / 10000;
    }
}
