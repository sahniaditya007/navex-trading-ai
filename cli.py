"""
NAVEX Trading AI - Command Line Interface (CLI).
Allows running automated terminal simulations, executing historical replay scenarios,
inspecting portfolio equity, and reviewing decision memory without requiring the web dashboard.
"""

import sys
import argparse
from pathlib import Path

# Add backend directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.config import settings
from core.schemas import TradeBias
from services.context.context_builder import build_market_context
from agents.analyst_agent import AnalystAgent, thesis_to_decision
from agents.review_agent import ReviewAgent
from risk.risk_engine import RiskEngine
from simulation.portfolio import Portfolio
from simulation.execution_engine import ExecutionEngine
from simulation.replay_engine import ReplayEngine
from memory.database import MemoryDatabase


def run_demo_simulation():
    """Runs a complete end-to-end NAVEX trading workflow in the console."""
    print("=" * 70)
    print("NAVEX CAPITAL AI TRADING — END-TO-END DEMONSTRATION WORKFLOW")
    print("=" * 70)

    # Initialize components
    db = MemoryDatabase()
    portfolio = Portfolio(initial_balance=100000.0)
    execution_engine = ExecutionEngine(portfolio=portfolio)
    risk_engine = RiskEngine()
    analyst = AnalystAgent()
    reviewer = ReviewAgent()
    replay = ReplayEngine("BTC_BULL_BREAKOUT")

    print("\n[STEP 1: MARKET CONTEXT AGGREGATION]")
    prior_lessons = db.get_prior_learnings(limit=3)
    print(f"-> Injected Prior Decision Memory: {len(prior_lessons)} lessons")
    for l in prior_lessons:
        print(f"   * {l}")

    context = build_market_context(
        asset="BTC/USDT",
        timeframe="1h",
        custom_candles=replay.get_visible_candles(),
        prior_learnings=prior_lessons
    )
    print(f"-> Asset: {context.asset} | Current Price: ${context.current_price:,.2f}")
    print(f"-> Structure: {context.market_structure} | Trend: {context.trend}")
    print(f"-> Indicators: RSI={context.rsi} | ATR=${context.atr} | EMA20=${context.ema_20} | EMA50=${context.ema_50}")
    if context.microstructure:
        print(f"-> Microstructure: Spread=${context.microstructure.bid_ask_spread} | Imbalance={context.microstructure.volume_imbalance:+.2f}")

    print("\n[STEP 2: AI ANALYST TRADE THESIS]")
    thesis = analyst.analyze(context)
    print(f"-> Decision Bias : {thesis.bias.value}")
    print(f"-> Confidence    : {thesis.confidence * 100:.1f}%")
    print(f"-> Thesis        : {thesis.thesis}")
    print(f"-> Invalidation  : {thesis.invalidation_condition}")
    print(f"-> Supporting    : {thesis.supporting_factors}")
    print(f"-> Conflicting   : {thesis.conflicting_factors}")

    prelim_decision = thesis_to_decision(thesis, context.current_price)
    print(f"-> Proposed Entry: ${prelim_decision.entry:,.2f} | SL: ${prelim_decision.stop_loss:,.2f} | TP: ${prelim_decision.take_profit:,.2f}")

    print("\n[STEP 3: DETERMINISTIC RISK ENGINE EVALUATION]")
    assessment = risk_engine.evaluate_trade(prelim_decision, account_equity=portfolio.equity)
    print(f"-> Risk Status   : {assessment.status.value}")
    for chk in assessment.checks:
        status_icon = "PASS" if chk.passed else "FAIL"
        print(f"   [{status_icon}] {chk.check_name}: {chk.details}")

    if assessment.status.value == "REJECTED":
        print(f"-> VETO REASONS  : {assessment.rejection_reasons}")
        print("-> Trade rejected by risk engine guardrails. Execution halted.")
        return

    print(f"-> Position Sized: {assessment.calculated_position_size} BTC (${assessment.risk_amount:,.2f} risk / {assessment.risk_percentage}% equity)")
    print(f"-> Risk/Reward   : {assessment.risk_reward_ratio}:1")

    print("\n[STEP 4: SIMULATED PAPER EXECUTION]")
    position = execution_engine.execute_order(
        decision=assessment.decision,
        risk_assessment=assessment,
        thesis=thesis,
        asset=context.asset
    )
    print(f"-> Order ID      : {position.id}")
    print(f"-> Fill Price    : ${position.fill_price:,.2f} (Slippage: ${position.slippage_cost:,.2f})")
    print(f"-> Notional Value: ${position.notional_value:,.2f}")
    print(f"-> Taker Fee     : ${position.fees:,.2f}")
    print(f"-> Order Status  : {position.status.value}")

    print("\n[STEP 5: BAR-BY-BAR SIMULATION ADVANCEMENT]")
    step_count = 0
    outcome = None
    while replay.has_next_bar() and not outcome:
        step_count += 1
        candle, is_finished = replay.advance_bar()
        updated_pos, outcome = execution_engine.evaluate_bar(
            position_id=position.id,
            current_price=candle.close,
            high=candle.high,
            low=candle.low,
            bar_index=step_count
        )
        print(f"   Bar {replay.current_index:02d} | Close: ${candle.close:,.2f} | High: ${candle.high:,.2f} | Low: ${candle.low:,.2f} | Unrealized P&L: ${updated_pos.net_pnl:+,.2f}")

    if outcome:
        print("\n[STEP 6: TRADE OUTCOME DETECTED]")
        print(f"-> Exit Triggered: {outcome.closure_reason.value} at ${outcome.exit_price:,.2f}")
        print(f"-> Net P&L       : ${outcome.net_pnl:+,.2f} ({outcome.return_pct:+.2f}%)")
        print(f"-> Total Fees    : ${outcome.fees:,.2f}")
        print(f"-> Duration      : {outcome.duration_bars} bars")

        print("\n[STEP 7: POST-TRADE AI REVIEW]")
        review = reviewer.review(outcome)
        print(f"-> Outcome Class : {review.outcome}")
        print(f"-> Thesis Correct: {review.thesis_correct}")
        print(f"-> Quality       : {review.execution_quality}")
        print(f"-> What Worked   : {review.what_worked}")
        print(f"-> What Failed   : {review.what_failed}")
        print(f"-> Root Cause    : {review.why}")
        print(f"-> Lessons       : {review.lessons_learned}")

        print("\n[STEP 8: EPISODIC MEMORY UPDATE]")
        db.save_completed_trade(position=updated_pos, thesis=thesis, review=review)
        print(f"-> Recorded trade {updated_pos.id} and {len(review.lessons_learned)} lessons into SQLite database.")

        print("\n[STEP 9: PORTFOLIO SUMMARY]")
        state = portfolio.get_state()
        print(f"-> Starting Cash : ${state.initial_balance:,.2f}")
        print(f"-> Ending Equity : ${state.equity:,.2f} ({state.realized_pnl:+,.2f})")
        print(f"-> Total Trades  : {state.total_trades} (Win Rate: {state.win_rate}%)")
        print("=" * 70)
        print("WORKFLOW COMPLETE: Feedback loop verified from context to memory.")
        print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="NAVEX Trading AI CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    subparsers.add_parser("demo", help="Run full automated end-to-end terminal demo")
    subparsers.add_parser("server", help="Run FastAPI web server")
    subparsers.add_parser("portfolio", help="Inspect portfolio balance and equity")
    subparsers.add_parser("memory", help="Inspect trade lessons in episodic memory")

    args = parser.parse_args()

    if args.command == "demo" or args.command is None:
        run_demo_simulation()
    elif args.command == "server":
        import uvicorn
        uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
    elif args.command == "portfolio":
        p = Portfolio()
        state = p.get_state()
        print(f"Cash: ${state.cash:,.2f} | Equity: ${state.equity:,.2f} | Realized P&L: ${state.realized_pnl:,.2f}")
    elif args.command == "memory":
        db = MemoryDatabase()
        lessons = db.get_prior_learnings(10)
        print(f"Found {len(lessons)} trade lessons:")
        for idx, l in enumerate(lessons, 1):
            print(f"{idx}. {l}")


if __name__ == "__main__":
    main()
