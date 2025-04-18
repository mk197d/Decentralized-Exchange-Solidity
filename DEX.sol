// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./Token.sol";
import "./LPToken.sol";

contract DEX {
    TokenA public tokenA;
    TokenB public tokenB;
    LPToken public lpToken;
    
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public constant FEE_NUMERATOR = 997;
    uint256 public constant FEE_DENOMINATOR = 1000;
    uint256 public tokenA_fee;
    uint256 public tokenB_fee;
    
    constructor(address _tokenA, address _tokenB) {
        tokenA = TokenA(_tokenA);
        tokenB = TokenB(_tokenB);
        lpToken = new LPToken();
        lpToken.transferOwnership(address(this));
    }
    
    function getSpotPriceAperB() public view returns (uint256) {
        require(reserveB > 0, "No tokenB liquidity");
        return (reserveA * 1e10) / reserveB;
    }
    
    function getSpotPriceBperA() public view returns (uint256) {
        require(reserveA > 0, "No tokenA liquidity");
        return (reserveB * 1e10) / reserveA;
    }
    
    function addLiquidity(uint256 amountA, uint256 amountB) external {
        if (reserveA == 0 && reserveB == 0) {
            // First liquidity provision
            tokenA.transferFrom(msg.sender, address(this), amountA);
            tokenB.transferFrom(msg.sender, address(this), amountB);
            
            reserveA = amountA;
            reserveB = amountB;
            
            uint256 lp = sqrt(amountA * amountB);
            lpToken.mint(msg.sender, lp);
        } 
        else {
            // Adding to existing liquidity - maintain ratio
            // uint256 expectedB = (amountA * reserveB) / reserveA;

            tokenA.transferFrom(msg.sender, address(this), amountA);
            tokenB.transferFrom(msg.sender, address(this), amountB);
            
            uint256 lp = (amountA * lpToken.totalSupply()) / reserveA;
            reserveA += amountA;
            reserveB += amountB;
            lpToken.mint(msg.sender, lp);

        }
    }
    
    function removeLiquidity(uint256 lpAmount) external {
        require(lpAmount > 0, "Invalid amount");
        uint256 totalLP = lpToken.totalSupply();
        require(totalLP > 0, "No LP tokens exist");
        
        uint256 amountA = (reserveA * lpAmount) / totalLP;
        uint256 amountB = (reserveB * lpAmount) / totalLP;
        
        lpToken.burn(msg.sender, lpAmount);
        reserveA -= amountA;
        reserveB -= amountB;
        
        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);
    }
    
    function swapAforB(uint256 amountAIn) external {
        require(amountAIn > 0, "Zero input");
        require(reserveA > 0 && reserveB > 0, "Insufficient liquidity");
        
        tokenA.transferFrom(msg.sender, address(this), amountAIn);
        
        uint256 amountInWithFee = amountAIn * FEE_NUMERATOR;
        uint256 numerator = amountInWithFee * reserveB;
        uint256 denominator = (reserveA * FEE_DENOMINATOR) + amountInWithFee;
        uint256 amountBOut = numerator / denominator;
        
        tokenA_fee += amountAIn - (amountAIn * FEE_NUMERATOR) / FEE_DENOMINATOR;

        require(amountBOut > 0, "Insufficient output amount");
        require(amountBOut < reserveB, "Insufficient liquidity");
        
        reserveA += amountAIn;
        tokenB.transfer(msg.sender, amountBOut);

        // The fee will be distributed to LPs
        uint256 BOut_without_fee = (amountAIn * reserveB) / (reserveA + amountAIn);
        reserveB -= BOut_without_fee;
    }
    
    function swapBforA(uint256 amountBIn) external {
        require(amountBIn > 0, "Zero input");
        require(reserveA > 0 && reserveB > 0, "Insufficient liquidity");
        
        tokenB.transferFrom(msg.sender, address(this), amountBIn);
        
        uint256 amountInWithFee = amountBIn * FEE_NUMERATOR;
        uint256 numerator = amountInWithFee * reserveA;
        uint256 denominator = (reserveB * FEE_DENOMINATOR) + amountInWithFee;
        uint256 amountAOut = numerator / denominator;
        
        tokenB_fee += amountBIn - (amountBIn * FEE_NUMERATOR) / FEE_DENOMINATOR;

        require(amountAOut > 0, "Insufficient output amount");
        require(amountAOut < reserveA, "Insufficient liquidity");
        
        reserveB += amountBIn;
        
        
        tokenA.transfer(msg.sender, amountAOut);

        // The fee will be distributed to LPs
        uint256 AOut_without_fee = (amountBIn * reserveA) / (reserveB + amountBIn);
        reserveA -= AOut_without_fee;
    }
    
    function getReserves() external view returns (uint256, uint256) {
        return (reserveA, reserveB);
    }

    function getFee() external view returns (uint256, uint256) {
        return (tokenA_fee, tokenB_fee);
    }
    
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
