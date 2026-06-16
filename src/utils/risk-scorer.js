import {
    RISK_WINDOW_MS,
    TIME_WEIGHTS,
    CATEGORY_DIVERSITY_BONUS,
    CATEGORY_DIVERSITY_THRESHOLD,
} from '../constants/security-events.js';

export function calculateRiskScore(events) {
    if (!Array.isArray(events) || events.length === 0) {
        return { score: 0, eventCount: 0, categories: new Set(), breakdown: {} };
    }

    const now = Date.now();
    const windowStart = now - RISK_WINDOW_MS;
    let totalScore = 0;
    const categorySet = new Set();

    const eventTypeCounts = {};

    for (const event of events) {
        const eventTime = event.timestamp || 0;
        if (eventTime < windowStart) continue;

        const baseScore = event.severity_score || 0;
        let multiplier = 1.0;

        const age = now - eventTime;
        if (age <= TIME_WEIGHTS.ONE_HOUR.maxAgeMs) {
            multiplier = TIME_WEIGHTS.ONE_HOUR.multiplier;
        } else if (age <= TIME_WEIGHTS.ONE_DAY.maxAgeMs) {
            multiplier = TIME_WEIGHTS.ONE_DAY.multiplier;
        }

        totalScore += baseScore * multiplier;

        if (event.category) {
            categorySet.add(event.category);
        }

        const eventType = event.event_type || 'UNKNOWN';
        eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
    }

    if (categorySet.size >= CATEGORY_DIVERSITY_THRESHOLD) {
        totalScore = Math.round(totalScore * (1 + CATEGORY_DIVERSITY_BONUS));
    }

    return {
        score: Math.round(totalScore),
        eventCount: events.length,
        categories: categorySet,
        breakdown: eventTypeCounts,
    };
}

export function getRecommendedBlockThreshold() {
    return 150;
}

export function getCriticalThreshold() {
    return 300;
}
