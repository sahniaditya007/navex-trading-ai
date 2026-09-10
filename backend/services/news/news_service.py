"""
News and Sentiment Context Service.
Adapted from Crypto-Pilot-AI-Models:
  - Original Path: src/sentiment/sentiment_analysis.py (lines 64-92)
  - What was retained: regex-based URL and special character cleaning, whitespace normalization.
  - What was changed: removed heavy NLTK/TextBlob dependencies that had brittle download paths,
                      rebuilt as structured NewsItem generator that provides contextual narrative
                      for LLM reasoning rather than an isolated scalar polarity score.
"""

import re
import requests
from datetime import datetime, timezone
from typing import List
from core.schemas import NewsItem
from core.config import settings

URL_PATTERN = re.compile(r"http\S+|www\S+|https\S+")
SPECIAL_CHARS_PATTERN = re.compile(r"[^\w\s\.,;:!\?\-\$\%]")


def clean_news_text(text: str) -> str:
    """
    Cleans raw news headline or body text.
    Adapted from Crypto-Pilot text preprocessing logic.
    """
    if not isinstance(text, str):
        return ""
    text = URL_PATTERN.sub("", text)
    text = SPECIAL_CHARS_PATTERN.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def get_curated_news(asset: str = "BTC/USDT", scenario: str = "BULLISH") -> List[NewsItem]:
    """
    Returns structured news items for the asset and scenario.
    Provides realistic market context for the LLM analyst.
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # 🔵 Third-party: optional live providers. Keep replay deterministic and
    # fall back explicitly when providers are unavailable or unconfigured.
    if settings.NEWS_PROVIDER != "fallback" and scenario != "REPLAY":
        live_items = _fetch_live_news(asset)
        if live_items:
            return live_items

    if "XAU" in asset.upper() or "GOLD" in asset.upper():
        items = [
            NewsItem(
                headline="Central Banks Accelerate Gold Purchases Amid De-Dollarization Trend",
                source="World Gold Council",
                published_at=now_iso,
                summary="Sovereign reserve managers accumulated record net tonnes of physical gold bullion as macro geopolitical diversification intensifies.",
                relevance="high",
                sentiment_hint="bullish"
            ),
            NewsItem(
                headline="Gold Tests Structural Highs on US Real Yield Softening",
                source="Financial Times",
                published_at=now_iso,
                summary="Spot bullion traded above key resistance as institutional fixed income investors hedge currency debasement risks.",
                relevance="high",
                sentiment_hint="bullish"
            )
        ]
    elif "EUR" in asset.upper():
        items = [
            NewsItem(
                headline="ECB Gauges Policy Path as Eurozone Core Inflation Moderates",
                source="Reuters",
                published_at=now_iso,
                summary="European Central Bank governing council evaluated rate decisions against balanced trade data and German manufacturing survey rebound.",
                relevance="high",
                sentiment_hint="neutral"
            ),
            NewsItem(
                headline="Euro Consolidates Above Key Support Zone Against US Dollar",
                source="Bloomberg FX",
                published_at=now_iso,
                summary="EUR/USD order flow maintained positive delta on transatlantic interest rate spread narrowing.",
                relevance="medium",
                sentiment_hint="bullish"
            )
        ]
    elif "ETH" in asset.upper():
        items = [
            NewsItem(
                headline="Ethereum Layer 2 TVL Hits New All-Time High Amid Network Upgrades",
                source="CoinDesk",
                published_at=now_iso,
                summary="Total value locked across Ethereum rollup solutions surpassed record levels, indicating persistent network demand.",
                relevance="high",
                sentiment_hint="bullish"
            ),
            NewsItem(
                headline="Institutional Inflows Rise For Staking Products",
                source="Bloomberg Crypto",
                published_at=now_iso,
                summary="Institutional asset managers reported a third consecutive week of net inflows into ETH-focused staking derivatives.",
                relevance="high",
                sentiment_hint="bullish"
            )
        ]
    elif scenario == "BEARISH":
        items = [
            NewsItem(
                headline="Federal Reserve Signals Slower Rate Cut Path as Inflation Lingers",
                source="Reuters",
                published_at=now_iso,
                summary="FOMC minutes highlight committee caution regarding persistent core services inflation, reducing market expectations of near-term liquidity expansion.",
                relevance="high",
                sentiment_hint="bearish"
            ),
            NewsItem(
                headline="Crypto Exchange Inflows Spike as Longs Unwind Across Derivatives",
                source="CoinDesk",
                published_at=now_iso,
                summary="More than $300M in long positions were liquidated over the past 12 hours as key support levels failed to hold.",
                relevance="high",
                sentiment_hint="bearish"
            ),
            NewsItem(
                headline="Mining Hashrate Faces Seasonal Curtailment, Slight Miner Selling Observed",
                source="Glassnode Insights",
                published_at=now_iso,
                summary="On-chain reserves from mining pools showed modest net outflows, adding slight supply pressure.",
                relevance="medium",
                sentiment_hint="neutral"
            )
        ]
    else:  # Default BULLISH scenario
        items = [
            NewsItem(
                headline="Bitcoin Spot ETFs Record $420M Net Inflows in Single Session",
                source="Bloomberg Intelligence",
                published_at=now_iso,
                summary="Institutional demand for spot Bitcoin ETFs accelerated with major asset managers absorbing over 6,500 BTC in secondary market purchases.",
                relevance="high",
                sentiment_hint="bullish"
            ),
            NewsItem(
                headline="Fed Chair Powell Hints at Rate Easing Cycle as Labor Market Cools",
                source="Wall Street Journal",
                published_at=now_iso,
                summary="Recent macro commentary suggests the Federal Reserve is preparing to initiate interest rate reductions, boosting risk asset sentiment.",
                relevance="high",
                sentiment_hint="bullish"
            ),
            NewsItem(
                headline="Exchange Reserve Balances Decline to Multi-Year Lows",
                source="CryptoQuant",
                published_at=now_iso,
                summary="Liquid BTC supply across major spot exchanges continues to contract as long-term holders move coins to cold custody.",
                relevance="medium",
                sentiment_hint="bullish"
            )
        ]

    # Clean all headlines and summaries
    for item in items:
        item.headline = clean_news_text(item.headline)
        item.summary = clean_news_text(item.summary)

    return items


def _fetch_live_news(asset: str) -> List[NewsItem]:
    """Fetch current crypto headlines without exposing provider keys to clients."""
    currency = asset.split("/")[0].upper()
    providers = [settings.NEWS_PROVIDER] if settings.NEWS_PROVIDER != "auto" else [
        "cryptopanic",
        "newsapi",
    ]

    for provider in providers:
        try:
            if provider == "cryptopanic" and settings.CRYPTOPANIC_API_KEY:
                response = requests.get(
                    "https://cryptopanic.com/api/v1/posts/",
                    params={
                        "auth_token": settings.CRYPTOPANIC_API_KEY,
                        "currencies": currency,
                        "filter": "important",
                        "public": "true",
                    },
                    timeout=settings.MARKET_DATA_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                results = response.json().get("results", [])
                items = [
                    NewsItem(
                        headline=clean_news_text(item.get("title", "")),
                        source=item.get("source", {}).get("title", "CryptoPanic"),
                        published_at=item.get("published_at", ""),
                        summary=clean_news_text(item.get("title", "")),
                        relevance="high" if item.get("votes", {}).get("important", 0) else "medium",
                        sentiment_hint="neutral",
                    )
                    for item in results[:5]
                    if item.get("title")
                ]
                if items:
                    return items

            if provider == "newsapi" and settings.NEWSAPI_KEY:
                response = requests.get(
                    "https://newsapi.org/v2/everything",
                    params={
                        "apiKey": settings.NEWSAPI_KEY,
                        "q": f"{currency} crypto",
                        "language": "en",
                        "sortBy": "publishedAt",
                        "pageSize": 5,
                    },
                    timeout=settings.MARKET_DATA_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                articles = response.json().get("articles", [])
                items = [
                    NewsItem(
                        headline=clean_news_text(article.get("title", "")),
                        source=article.get("source", {}).get("name", "NewsAPI"),
                        published_at=article.get("publishedAt", ""),
                        summary=clean_news_text(article.get("description") or article.get("title", "")),
                        relevance="medium",
                        sentiment_hint="neutral",
                    )
                    for article in articles[:5]
                    if article.get("title")
                ]
                if items:
                    return items
        except (requests.RequestException, ValueError, KeyError, TypeError):
            continue

    return []
