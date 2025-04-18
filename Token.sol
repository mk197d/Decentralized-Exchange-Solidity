// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
// Import OpenZeppelin ERC20 contract
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenA is ERC20 {
    address public owner;
    
    constructor(uint256 initialSupply) ERC20("Token A", "TKA") {
        owner = msg.sender;
        _mint(msg.sender, initialSupply * (10 ** decimals()));
    }

    function myApprove(address other_owner, address spender, uint256 amount) external {
        super._approve(other_owner, spender, amount);
    }
    
    // function mint(address to, uint256 amount) external {
    //     require(msg.sender == owner, "Only owner can mint");
    //     _mint(to, amount);
    // }
}

contract TokenB is ERC20 {
    address public owner;
    
    constructor(uint256 initialSupply) ERC20("Token B", "TKB") {
        owner = msg.sender;
        _mint(msg.sender, initialSupply * (10 ** decimals()));
    }

    function myApprove(address other_owner, address spender, uint256 amount) external {
        super._approve(other_owner, spender, amount);
    }
    
    // function mint(address to, uint256 amount) external {
    //     require(msg.sender == owner, "Only owner can mint");
    //     _mint(to, amount);
    // }
}