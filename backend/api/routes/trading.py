"""
FastAPI REST Routes for NAVEX Trading AI.
Provides typed endpoints for the complete NAVEX Trading lifecycle:
Context -> Analysis -> Risk Validation -> Simulated Execution -> Step -> Review -> Memory.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from core.schemas import (
    MarketContext,
    MarketContextRequest,
    AnalyzeRequest,
    ValidateTradeRequest,
    ExecuteRequest,
    StepRequest,
    ReviewRequest,
    ReplayStartRequest,
    TradeThesis,
    TradeDecision,
    RiskAssessment,
    SimulatedPosition,
    PostTradeReview,
    PortfolioState,
    TradeOutcome,
    ClosureReason,
    CloseRequest,
)
from services.context.context_builder import build_market_context
from agents.analyst_agent import AnalystAgent, thesis_to_decision
from agents.review_agent import ReviewAgent
from risk.risk_engine import RiskEngine
from simulation.portfolio import Portfolio
from simulation.execution_engine import ExecutionEngine
from simulation.replay_engine import ReplayEngine
from memory.database import MemoryDatabase

router = APIRouter(prefix="/api", tags=["trading"])

# Instantiate stateful singleton services
portfolio = Portfolio()
execution_engine = ExecutionEngine(portfolio=portfolio)
risk_engine = RiskEngine()
analyst_agent = AnalystAgent()
review_agent = ReviewAgent()
replay_engine = ReplayEngine()
memory_db = MemoryDatabase()


@router.post("/market-context", response_model=MarketContext)
async def api_get_market_context(payload: Optional[MarketContextRequest] = None):
    """
    Builds a structured MarketContext for the selected asset and timeframe.
    Injects prior lessons from episodic memory into context.
    """
    asset = payload.asset if payload else "BTC/USDT"
    timeframe = payload.timeframe if payload else "1h"
    mode = payload.mode if payload else "demo"

    # Fetch prior trade learnings from memory
    learnings = memory_db.get_prior_learnings(limit=4)

    # In replay mode, use visible candles from replay engine if matching
    custom_candles = None
    if mode == "replay":
        custom_candles = replay_engine.get_visible_candles()

    try:
        context = build_market_context(
            asset=asset,
            timeframe=timeframe,
            custom_candles=custom_candles,
            prior_learnings=learnings,
            # Replay is deterministic; demo mode uses the public market feed.
            force_fallback=(mode == "replay")
        )
        return context
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate market context: {str(e)}")


@router.post("/analyze")
async def api_analyze_market(payload: AnalyzeRequest):
    """
    Invokes AI Analyst Agent with structured MarketContext.
    Returns both the validated TradeThesis and the preliminary TradeDecision.
    """
    try:
        thesis: TradeThesis = analyst_agent.analyze(payload.context)
        decision: TradeDecision = thesis_to_decision(thesis, payload.context.current_price)
        return {
            "status": "success",
            "thesis": thesis,
            "decision": decision
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/validate-trade", response_model=RiskAssessment)
async def api_validate_trade(payload: ValidateTradeRequest):
    """
    Evaluates proposed TradeDecision against deterministic risk guardrails.
    Applies position sizing formula and has veto authority.
    """
    equity = payload.account_equity or portfolio.equity
    try:
        assessment = risk_engine.evaluate_trade(payload.decision, account_equity=equity)
        return assessment
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk validation error: {str(e)}")


@router.post("/execute", response_model=SimulatedPosition)
async def api_execute_simulated(payload: ExecuteRequest):
    """
    Simulates paper execution of an approved trade.
    Applies slippage and fees, transitions to OPEN state.
    """
    try:
        decision = payload.decision.model_copy(update={
            key: value for key, value in {
                "entry": payload.entry,
                "stop_loss": payload.stop_loss,
                "take_profit": payload.take_profit,
                "position_size": payload.position_size,
            }.items() if value is not None
        })
        assessment = risk_engine.evaluate_trade(
            decision,
            account_equity=payload.risk_assessment.account_equity,
        )
        if assessment.status.value != "APPROVED":
            raise HTTPException(status_code=400, detail="Execution parameters failed risk validation.")
        position = execution_engine.execute_order(
            decision=assessment.decision,
            risk_assessment=assessment,
            thesis=payload.thesis,
            asset=payload.asset,
        )
        return position
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Execution error: {str(e)}")


@router.post("/close", response_model=PostTradeReview)
async def api_close_position(payload: CloseRequest):
    """Closes a paper position and immediately persists its structured review."""
    try:
        outcome = execution_engine.close_manually(payload.position_id, payload.current_price)
        position = next(
            (item for item in portfolio.closed_positions if item.id == payload.position_id),
            None,
        )
        if position is None:
            raise HTTPException(status_code=404, detail="Closed position not found.")
        review = review_agent.review(outcome)
        memory_db.save_completed_trade(position, position.thesis, review)
        return review
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/step")
async def api_step_market(payload: StepRequest):
    """
    Advances the market price by one tick or bar.
    Evaluates active positions for Take Profit or Stop Loss triggers.
    Automatically generates an AI review upon trade closure.
    """
    active_positions = list(portfolio.active_positions.values())
    closed_events: List[Dict[str, Any]] = []

    for pos in active_positions:
        updated_pos, outcome = execution_engine.evaluate_bar(
            position_id=pos.id,
            current_price=payload.current_price,
            high=payload.high,
            low=payload.low,
            bar_index=payload.bar_index or 1
        )

        if outcome:
            # Auto-generate AI Review
            review: PostTradeReview = review_agent.review(outcome)
            # Store in episodic memory
            memory_db.save_completed_trade(position=updated_pos, thesis=updated_pos.thesis, review=review)

            closed_events.append({
                "position": updated_pos,
                "outcome": outcome,
                "review": review
            })

    # Update mark price for remaining positions
    portfolio.update_mark_price(payload.current_price)

    return {
        "current_price": payload.current_price,
        "portfolio": portfolio.get_state(),
        "closed_events": closed_events
    }


@router.post("/review", response_model=PostTradeReview)
async def api_generate_review(payload: ReviewRequest):
    """
    Explicit endpoint to generate or re-run an AI Review for a closed position.
    """
    # Look for position in closed positions
    pos = next((p for p in portfolio.closed_positions if p.id == payload.position_id), None)
    if not pos:
        raise HTTPException(status_code=404, detail="Closed position not found.")

    outcome = TradeOutcome(
        position_id=pos.id,
        asset=pos.asset,
        direction=pos.direction,
        entry_price=pos.fill_price,
        exit_price=pos.exit_price or pos.current_price,
        quantity=pos.quantity,
        gross_pnl=pos.gross_pnl,
        fees=pos.fees,
        net_pnl=pos.net_pnl,
        return_pct=pos.return_pct,
        closure_reason=pos.closure_reason or ClosureReason.MANUAL_CLOSE,
        duration_bars=1,
        opened_at=pos.opened_at,
        closed_at=pos.closed_at or "",
        original_thesis=pos.thesis or TradeThesis(
            bias=pos.direction,
            confidence=0.8,
            thesis="Executed trade",
            market_structure="TREND",
            catalysts=[],
            supporting_factors=[],
            conflicting_factors=[],
            key_levels={},
            invalidation_condition="Stop breach",
            entry_reason="Trigger",
            stop_loss_reason="Stop",
            take_profit_reason="Target",
            risk_considerations=[],
            assumptions=[]
        )
    )

    review = review_agent.review(outcome)
    memory_db.save_completed_trade(pos, pos.thesis, review)
    return review


@router.get("/positions", response_model=List[SimulatedPosition])
async def api_get_active_positions():
    """Returns currently open paper positions."""
    return list(portfolio.active_positions.values())


@router.get("/history")
async def api_get_history():
    """Returns historical trade records from memory."""
    return {
        "closed_positions": portfolio.closed_positions,
        "db_records": memory_db.get_trade_history(20)
    }


@router.get("/portfolio", response_model=PortfolioState)
async def api_get_portfolio():
    """Returns the current portfolio equity, cash, and performance metrics."""
    return portfolio.get_state()


@router.get("/memory")
async def api_get_memory():
    """Returns episodic decision memory, recent reviews, and learned principles."""
    return {
        "prior_learnings": memory_db.get_prior_learnings(10),
        "recent_reviews": memory_db.get_all_reviews(5)
    }


@router.post("/replay/start")
async def api_replay_start(payload: ReplayStartRequest):
    """
    Initializes a predefined replay scenario.
    Resets replay index and returns initial market state.
    """
    info = replay_engine.load_scenario(payload.scenario)
    context = build_market_context(
        asset="BTC/USDT",
        timeframe="1h",
        custom_candles=replay_engine.get_visible_candles(),
        prior_learnings=memory_db.get_prior_learnings(3),
    )
    return {
        "scenario_info": info,
        "market_context": context,
        "portfolio": portfolio.get_state(),
    }


@router.post("/replay/step")
async def api_replay_step():
    """
    Advances replay scenario by one bar.
    Evaluates open positions, triggers TP/SL, and auto-generates AI review upon trade exit.
    """
    if not replay_engine.has_next_bar():
        return {
            "status": "completed",
            "message": "Replay scenario has reached the final bar.",
            "is_finished": True,
            "portfolio": portfolio.get_state()
        }

    new_candle, is_finished = replay_engine.advance_bar()

    # Evaluate any active positions against new candle
    closed_events = []
    for pos in list(portfolio.active_positions.values()):
        updated_pos, outcome = execution_engine.evaluate_bar(
            position_id=pos.id,
            current_price=new_candle.close,
            high=new_candle.high,
            low=new_candle.low,
            bar_index=replay_engine.current_index
        )
        if outcome:
            review = review_agent.review(outcome)
            memory_db.save_completed_trade(updated_pos, updated_pos.thesis, review)
            closed_events.append({
                "position": updated_pos,
                "outcome": outcome,
                "review": review
            })

    # Rebuild updated context
    context = build_market_context(
        asset="BTC/USDT",
        timeframe="1h",
        custom_candles=replay_engine.get_visible_candles(),
        prior_learnings=memory_db.get_prior_learnings(3),
    )

    return {
        "status": "stepped",
        "current_bar": replay_engine.current_index,
        "total_bars": len(replay_engine.all_candles),
        "is_finished": is_finished,
        "candle": new_candle,
        "market_context": context,
        "portfolio": portfolio.get_state(),
        "closed_events": closed_events
    }


@router.post("/reset")
async def api_reset_all():
    """Resets the portfolio and replay scenario to fresh starting state."""
    portfolio.reset()
    replay_engine.reset()
    return {"status": "success", "message": "System reset to $100,000 virtual balance."}
