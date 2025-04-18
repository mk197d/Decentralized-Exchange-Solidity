import re
import matplotlib.pyplot as plt
import numpy as np
import sys

# Set a professional style
plt.style.use('ggplot')

if len(sys.argv) != 2:
    print("Usage: python plot.py <log_file>")
    sys.exit(1)

log_file = sys.argv[1]

# Initialize data storage
iterations = []
tvl_list = []
reserve_ratios = []
token_a_swapped = []
token_b_swapped = []
slippages = []
spot_prices = []
feeA_list = []
feeB_list = []

raw_slippages = []
trade_lot_fracs = []

# Defaults for carrying forward
last_tvl = None
last_rr = None
last_a = 0
last_b = 0
last_slippage = None
last_spot = None
last_fee_a = 0
last_fee_b = 0

with open(log_file, 'r') as f:
    lines = f.readlines()

for line in lines:
    if line.startswith("Iteration:"):
        iter_num = int(re.search(r"Iteration: (\d+)", line).group(1))
        iterations.append(iter_num)
        
        # Prepare defaults for this iteration
        tvl, rr, a_swap, b_swap, slip, spot = last_tvl, last_rr, last_a, last_b, last_slippage, last_spot
        fee_a, fee_b = last_fee_a, last_fee_b

    if line.startswith("TVL:"):
        try:
            tvl = int(re.search(r"TVL: (\d+)", line).group(1))
            last_tvl = tvl
        except (ValueError, AttributeError):
            pass
        
    if "Reserve Ratio:" in line:
        try:
            rr = float(re.search(r"Reserve Ratio: ([0-9.]+)", line).group(1))
            last_rr = rr
        except (ValueError, AttributeError):
            pass
        
    if "TokenA swapped:" in line:
        try:
            a_swap = int(re.search(r"TokenA swapped: (-?\d+)", line).group(1))
            last_a = a_swap
        except (ValueError, AttributeError):
            pass
        
    if "TokenB swapped:" in line:
        try:
            b_swap = int(re.search(r"TokenB swapped: (-?\d+)", line).group(1))
            last_b = b_swap
        except (ValueError, AttributeError):
            pass
        
    if "Slippage" in line:
        try:
            slip = float(re.search(r"Slippage.*: (-?[0-9.]+)%", line).group(1))
            last_slippage = slip
            raw_slippages.append(slip)
        except (ValueError, AttributeError):
            pass
        
    if "Swap Exchange" in line:
        try:
            spot = float(re.search(r"Swap Exchange.*: ([0-9.]+)", line).group(1))
            last_spot = spot
        except (ValueError, AttributeError):
            pass
        
    if "FeeA" in line:
        try:
            fee_a = float(re.search(r"FeeA.*: ([0-9.]+)", line).group(1))
            last_fee_a = fee_a
        except (ValueError, AttributeError):
            pass

    if "FeeB" in line:
        try:
            fee_b = float(re.search(r"FeeB.*: ([0-9.]+)", line).group(1))
            last_fee_b = fee_b
        except (ValueError, AttributeError):
            pass

    if "Trade Lot Fraction" in line:
        try:
            trade_lot_frac = float(re.search(r"Trade Lot Fraction:  ([0-9.]+)", line).group(1))
            trade_lot_fracs.append(trade_lot_frac)
        except (ValueError, AttributeError):
            pass


    if line.strip() == "" or "Iteration:" in line:
        if len(tvl_list) < len(iterations):
            tvl_list.append(tvl if tvl is not None else 0)
            reserve_ratios.append(rr if rr is not None else 0)
            token_a_swapped.append(a_swap if a_swap is not None else 0)
            token_b_swapped.append(b_swap if b_swap is not None else 0)
            slippages.append(slip if slip is not None else 0)
            spot_prices.append(spot if spot is not None else 0)
            feeA_list.append(fee_a if fee_a is not None else 0)
            feeB_list.append(fee_b if fee_b is not None else 0)

# Replace any remaining None values with 0
tvl_list = [x if x is not None else 0 for x in tvl_list]
reserve_ratios = [x if x is not None else 0 for x in reserve_ratios]
token_a_swapped = [x if x is not None else 0 for x in token_a_swapped]
token_b_swapped = [x if x is not None else 0 for x in token_b_swapped]
slippages = [x if x is not None else 0 for x in slippages]
spot_prices = [x if x is not None else 0 for x in spot_prices]
feeA_list = [x if x is not None else 0 for x in feeA_list]
feeB_list = [x if x is not None else 0 for x in feeB_list]

# Color scheme
colors = {
    'tvl': '#1f77b4',         # Blue
    'reserve': '#ff7f0e',     # Orange
    'token_a': '#2ca02c',     # Green
    'token_b': '#d62728',     # Red
    'slippage': '#9467bd',    # Purple
    'spot': '#8c564b',        # Brown
    'background': '#f5f5f5',  # Light gray
    'grid': '#e5e5e5',         # Lighter gray
    'fee_a': '#e377c2',       # Pink
    'fee_b': '#7f7f7f',        # Gray
    'trade_lot': '#bcbd22'  # Yellow
}

# Create plots with enhanced styling
fig = plt.figure(figsize=(20, 15))
fig.patch.set_facecolor(colors['background'])

# Function to style each subplot consistently
def style_subplot(ax, title, ylabel, show_grid=True):
    ax.set_title(title, fontsize=14, fontweight='bold', pad=10)
    ax.set_ylabel(ylabel, fontsize=12)
    ax.set_xlabel('Iteration', fontsize=12)
    ax.tick_params(axis='both', which='major', labelsize=10)
    if show_grid:
        ax.grid(True, linestyle='--', alpha=0.7, color=colors['grid'])
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
    # Add some light shading to make it look more like a financial chart
    ax.set_facecolor(colors['background'])
    return ax

# TVL Plot
ax1 = plt.subplot(3, 3, 1)
ax1.plot(iterations, tvl_list, color=colors['tvl'], linewidth=2)
style_subplot(ax1, "Total Value Locked (TVL)", "Value")

# Reserve Ratio Plot
ax2 = plt.subplot(3, 3, 2)
ax2.plot(iterations, reserve_ratios, color=colors['reserve'], linewidth=2)
style_subplot(ax2, "Reserve Ratio", "Ratio")


# Token A Swapped
ax3 = plt.subplot(3, 3, 3)
ax3.bar(iterations, token_a_swapped, color=colors['token_a'], alpha=0.7, width=0.8)
style_subplot(ax3, "Token A Swapped", "Amount")

# Token B Swapped
ax4 = plt.subplot(3, 3, 4)
ax4.bar(iterations, token_b_swapped, color=colors['token_b'], alpha=0.7, width=0.8)
style_subplot(ax4, "Token B Swapped", "Amount")

# Slippage Plot
ax5 = plt.subplot(3, 3, 5)
ax5.plot(iterations, slippages, color=colors['slippage'], linewidth=2)
style_subplot(ax5, "Slippage (%)", "Percentage")

# Spot Price Plot
ax6 = plt.subplot(3, 3, 6)
ax6.plot(iterations, spot_prices, color=colors['spot'], linewidth=2, label='Spot Price')
style_subplot(ax6, "Swap Exchange Rate (A / B)", "Rate")

# Fee A Plot
ax7 = plt.subplot(3, 3, 7)
ax7.plot(iterations, feeA_list, color=colors['fee_a'], linewidth=2, label='Fee A')
style_subplot(ax7, "Fee A", "Amount")

# Fee B Plot
ax8 = plt.subplot(3, 3, 8)
ax8.plot(iterations, feeB_list, color=colors['fee_b'], linewidth=2, label='Fee B')
style_subplot(ax8, "Fee B", "Amount")

# Zip, sort by trade_lot_fracs, and unzip
sorted_pairs = sorted(zip(trade_lot_fracs, raw_slippages))
sorted_trade_lot_fracs, sorted_raw_slippages = zip(*sorted_pairs)

# Then plot the sorted values
ax9 = plt.subplot(3, 3, 9)
ax9.plot(sorted_trade_lot_fracs, sorted_raw_slippages, color=colors['trade_lot'], linewidth=2)
style_subplot(ax9, "Slippage v/s Trade Lot Fraction", "Slippage")
ax9.set_xlabel("Trade Lot Fraction", fontsize=12)


plt.tight_layout(pad=3.0)
plt.subplots_adjust(top=0.92)

# Save with high DPI for better quality
if(log_file[4] == '.'):
    plt.savefig(f"analysis_{log_file[:4]}.png", dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
else:
    plt.savefig(f"analysis_{log_file[:5]}.png", dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())

