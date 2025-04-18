// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./DEX.sol";
import "hardhat/console.sol";

contract Arbitrage {
    DEX public dex1;
    DEX public dex2;
    uint256 public minProfitThresholdNumerator;
    uint256 public minProfitThresholdDenominator;
    TokenA public tokenA;
    TokenB public tokenB;

    constructor(address dex1Address, address dex2Address) {
        dex1 = DEX(dex1Address);
        dex2 = DEX(dex2Address);
        minProfitThresholdDenominator = 10000;
        address tokenAAddress = address(dex1.tokenA());
        address tokenBAddress = address(dex1.tokenB());

        require(
            address(dex2.tokenA()) == tokenAAddress && 
            address(dex2.tokenB()) == tokenBAddress,
            "DEXes must have the same token pairs"
        );

        tokenA = TokenA(tokenAAddress);
        tokenB = TokenB(tokenBAddress);
    }

    function executeAtoBtoAarbitrage(uint256 amountAIn, uint256 _minProfitThresholdNumerator) 
    external {
        minProfitThresholdNumerator = _minProfitThresholdNumerator;
        address arbitrageur = msg.sender;

        (bool isProfitable, uint256 potentialProfit, DEX buyDex, DEX sellDex) = 
            calculateAtoBtoAProfitability(amountAIn);

        require(isProfitable, "Arbitrage not profitable");
        require(potentialProfit >= minProfitThresholdNumerator, "Profit below threshold");

        console.log("Arbitrageur: ", arbitrageur);

        tokenA.myApprove(arbitrageur, address(this), amountAIn);
        tokenA.transferFrom(arbitrageur, address(this), amountAIn);

        uint256 initialBalanceA = tokenA.balanceOf(address(this));

        console.log(initialBalanceA);
        console.log("Buy Dex: ", address(buyDex));

        tokenA.approve(address(buyDex), amountAIn);
        buyDex.swapAforB(amountAIn);

        console.log("Sell Dex: ", address(sellDex));

        uint256 balanceB = tokenB.balanceOf(address(this));
        tokenB.approve(address(sellDex), balanceB);
        sellDex.swapBforA(balanceB);

        uint256 finalBalanceA = tokenA.balanceOf(address(this));

        console.log("Final Price: ", finalBalanceA);

        uint256 actualProfit = finalBalanceA - initialBalanceA;
        tokenA.approve(address(this), finalBalanceA);
        tokenA.transferFrom(address(this), arbitrageur, finalBalanceA);

        require(actualProfit > 0, "Arbitrage resulted in loss");

        console.log("Profit: ", actualProfit);
    }

    function executeBtoAtoBarbitrage(uint256 amountBIn, uint256 _minProfitThresholdNumerator) 
    external {
        minProfitThresholdNumerator = _minProfitThresholdNumerator;
        address arbitrageur = msg.sender;
        
        (bool isProfitable, uint256 potentialProfit, DEX buyDex, DEX sellDex) = 
            calculateBtoAtoBProfitability(amountBIn);
        
        require(isProfitable, "Arbitrage not profitable");
        require(potentialProfit >= minProfitThresholdNumerator, "Profit below threshold");

        console.log("Arbitrageur: ", arbitrageur);
        
        tokenB.myApprove(arbitrageur, address(this), amountBIn);
        tokenB.transferFrom(arbitrageur, address(this), amountBIn);

        uint256 initialBalanceB = tokenB.balanceOf(address(this));

        console.log(initialBalanceB);
        console.log("Buy Dex: ", address(buyDex));

        tokenB.approve(address(buyDex), amountBIn);
        buyDex.swapBforA(amountBIn);

        console.log("Sell Dex: ", address(sellDex));

        uint256 balanceA = tokenA.balanceOf(address(this));
        tokenA.approve(address(sellDex), balanceA);
        sellDex.swapAforB(balanceA);

        uint256 finalBalanceB = tokenB.balanceOf(address(this));

        console.log("Final Price: ", finalBalanceB);

        uint256 actualProfit = finalBalanceB - initialBalanceB;
        tokenB.approve(address(this), finalBalanceB);
        tokenB.transferFrom(address(this), arbitrageur, finalBalanceB);

        require(actualProfit > 0, "Arbitrage resulted in loss");

        console.log("Profit: ", actualProfit);
    }

    function calculateAtoBtoAProfitability(uint256 amountAIn) 
        private view returns (bool isProfitable, uint256 potentialProfit, DEX buyDex, DEX sellDex) 
    {
        uint256 spotPrice1 = dex1.getSpotPriceBperA();
        uint256 spotPrice2 = dex2.getSpotPriceBperA();

        if (spotPrice1 < spotPrice2) {
            buyDex = dex2;
            sellDex = dex1;
        } else {
            buyDex = dex1;
            sellDex = dex2;
        }

        (uint256 reserveABuy, uint256 reserveBBuy) = buyDex.getReserves();
        (uint256 reserveASell, uint256 reserveBSell) = sellDex.getReserves();

        uint256 amountBOut = getAmountOut(amountAIn, reserveABuy, reserveBBuy);
        uint256 amountAOut = getAmountOut(amountBOut, reserveBSell, reserveASell);

        if (amountAOut > amountAIn) {
            potentialProfit = ((amountAOut - amountAIn) * minProfitThresholdDenominator) / amountAIn;
            isProfitable = true;
        } else {
            potentialProfit = 0;
            isProfitable = false;
        }

        return (isProfitable, potentialProfit, buyDex, sellDex);
    }

    function calculateBtoAtoBProfitability(uint256 amountBIn) 
        private view returns (bool isProfitable, uint256 potentialProfit, DEX buyDex, DEX sellDex) 
    {
        uint256 spotPrice1 = dex1.getSpotPriceAperB();
        uint256 spotPrice2 = dex2.getSpotPriceAperB();

        if (spotPrice1 < spotPrice2) {
            buyDex = dex2;
            sellDex = dex1;
        } else {
            buyDex = dex1;
            sellDex = dex2;
        }

        (uint256 reserveABuy, uint256 reserveBBuy) = buyDex.getReserves();
        (uint256 reserveASell, uint256 reserveBSell) = sellDex.getReserves();

        uint256 amountAOut = getAmountOut(amountBIn, reserveBBuy, reserveABuy);
        uint256 amountBOut = getAmountOut(amountAOut, reserveASell, reserveBSell);

        if (amountBOut > amountBIn) {
            potentialProfit = ((amountBOut - amountBIn) * minProfitThresholdDenominator) / amountBIn;
            isProfitable = true;
        } else {
            potentialProfit = 0;
            isProfitable = false;
        }

        return (isProfitable, potentialProfit, buyDex, sellDex);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256) {
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }

    function withdrawToken(address token, uint256 amount) external {
        ERC20(token).transfer(msg.sender, amount);
    }

    function depositTokens(address token, uint256 amount) external {
        ERC20(token).transferFrom(msg.sender, address(this), amount);
    }
}