import { createElement } from "$src/core/dom";
import type { QuotesWidgetSettings } from "$src/settings/schema";

const QUOTES_CACHE_KEY = "tabula:quote-of-day";
const ON_THIS_DAY_API = "https://today.zenquotes.io/api";

type QuoteCache = {
  date: string;
  quote: string;
  author: string;
};

type OnThisDayEvent = {
  text: string;
  html: string;
};

type OnThisDayResponse = {
  info: string;
  date: string;
  data: {
    Events?: OnThisDayEvent[];
    Births?: OnThisDayEvent[];
  };
};

const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const loadCachedQuote = (): QuoteCache | null => {
  try {
    const raw = localStorage.getItem(QUOTES_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as QuoteCache;
    if (cached.date !== getTodayString()) return null;
    return cached;
  } catch {
    return null;
  }
};

const saveCachedQuote = (quote: string, author: string): void => {
  try {
    const entry: QuoteCache = { date: getTodayString(), quote, author };
    localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Clean HTML entities and citation references from the text.
 */
const cleanText = (text: string): string => {
  return text
    .replace(/&#8211;/g, "–")
    .replace(/&#91;\d+&#93;/g, "") // Remove [1], [2] style citations
    .replace(/&#\d+;/g, "") // Remove other HTML entities
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Extract year and event description from OnThisDay text.
 * Format: "1642 – Abel Tasman is the first recorded European to sight New Zealand."
 */
const parseEvent = (text: string): { year: string; event: string } | null => {
  const cleaned = cleanText(text);
  const match = cleaned.match(/^(\d{4})\s*[–-]\s*(.+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { year: match[1], event: match[2] };
};

const fetchOnThisDay = async (signal?: AbortSignal): Promise<{ quote: string; author: string } | null> => {
  try {
    const init: RequestInit = signal ? { signal } : {};
    const response = await fetch(ON_THIS_DAY_API, init);
    if (!response.ok) return null;

    const data = (await response.json()) as OnThisDayResponse;
    if (!data?.data) return null;

    // Combine events and births, pick a random one
    const events = data.data.Events ?? [];
    const births = data.data.Births ?? [];
    const allItems = [...events.slice(0, 20), ...births.slice(0, 10)];

    if (allItems.length === 0) return null;

    // Pick a random item
    const randomIndex = Math.floor(Math.random() * allItems.length);
    const item = allItems[randomIndex];
    if (!item?.text) return null;

    const parsed = parseEvent(item.text);
    if (!parsed) return null;

    return {
      quote: parsed.event,
      author: `On this day, ${parsed.year}`,
    };
  } catch {
    return null;
  }
};

// Fallback quote if API fails
const FALLBACK_QUOTE = {
  quote: "The secret of getting ahead is getting started.",
  author: "Mark Twain",
};

class QuotesWidget {
  readonly element: HTMLElement;
  private readonly quoteEl: HTMLElement;
  private readonly authorEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private abortController: AbortController | null = null;

  constructor() {
    this.element = createElement("div", { className: "tabula-card tabula-widget tabula-widget--quotes" });

    this.quoteEl = createElement("p", { className: "tabula-widget__quote" });
    this.authorEl = createElement("p", { className: "tabula-widget__author" });
    this.statusEl = createElement("p", { className: "tabula-widget__status" });

    this.element.append(this.quoteEl, this.authorEl, this.statusEl);
    this.element.hidden = true;
    this.element.style.display = "none";
  }

  update(settings: QuotesWidgetSettings): void {
    if (!settings.enabled) {
      this.element.hidden = true;
      this.element.style.display = "none";
      return;
    }

    this.element.hidden = false;
    this.element.style.display = "";

    // Check if we have a cached quote for today
    const cached = loadCachedQuote();
    if (cached) {
      this.renderQuote(cached.quote, cached.author);
      this.statusEl.textContent = "";
      return;
    }

    // Fetch a new quote from OnThisDay API
    this.loadQuote();
  }

  destroy(): void {
    this.abortCurrentRequest();
  }

  private abortCurrentRequest(): void {
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // Ignore abort errors
      }
      this.abortController = null;
    }
  }

  private async loadQuote(): Promise<void> {
    this.statusEl.textContent = "Loading...";
    this.renderQuote("", "");

    this.abortCurrentRequest();
    this.abortController = new AbortController();

    try {
      const result = await fetchOnThisDay(this.abortController.signal);
      const { quote, author } = result ?? FALLBACK_QUOTE;
      saveCachedQuote(quote, author);
      this.renderQuote(quote, author);
      this.statusEl.textContent = "";
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      const { quote, author } = FALLBACK_QUOTE;
      saveCachedQuote(quote, author);
      this.renderQuote(quote, author);
      this.statusEl.textContent = "";
    } finally {
      this.abortController = null;
    }
  }

  private renderQuote(quote: string, author: string): void {
    this.quoteEl.textContent = quote || "";
    this.authorEl.textContent = author ? `— ${author}` : "";
  }
}

export type QuotesWidgetController = {
  element: HTMLElement;
  update: (settings: QuotesWidgetSettings) => void;
  destroy: () => void;
};

export const createQuotesWidget = (): QuotesWidgetController => {
  const widget = new QuotesWidget();
  return {
    element: widget.element,
    update: (settings) => widget.update(settings),
    destroy: () => widget.destroy(),
  };
};
