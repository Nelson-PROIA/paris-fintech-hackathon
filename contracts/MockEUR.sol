// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockEUR
 * @notice Minimal ERC-20 used as a mock EURC stablecoin in the Loanly demo.
 *         6 decimals to match real EURC. Mintable by the operator only — every
 *         new investor wallet is auto-funded by the platform with test balance.
 */
contract MockEUR {
    string public constant name = "Loanly Mock Euro";
    string public constant symbol = "mEURC";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    address public immutable operator;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 value);

    error NotOperator();
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor(address operator_) {
        operator = operator_;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function mint(address to, uint256 amount) external onlyOperator {
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Mint(to, amount);
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            unchecked {
                allowance[from][msg.sender] = allowed - amount;
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = fromBalance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}
