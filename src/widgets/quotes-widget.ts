import { createElement } from "$src/core/dom";
import type { QuotesWidgetSettings } from "$src/settings/schema";

const QUOTES_CACHE_KEY = "tabula:quote-of-day";
const QUOTESLATE_API = "https://quoteslate.vercel.app/api/quotes/random";

type QuoteCache = {
  date: string;
  quote: string;
  author: string;
};

// QuoteSlate returns a single object
type QuoteSlateResponse = {
  id: number;
  quote: string;
  author: string;
  length: number;
  tags: string[];
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

const fetchQuote = async (signal?: AbortSignal): Promise<{ quote: string; author: string } | null> => {
  try {
    const init: RequestInit = signal ? { signal } : {};
    const response = await fetch(QUOTESLATE_API, init);
    if (!response.ok) return null;

    const data = (await response.json()) as QuoteSlateResponse;
    if (!data?.quote || !data?.author) return null;

    return {
      quote: data.quote,
      author: data.author,
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
  private isLoading = false;

  constructor() {
    this.element = createElement("div", { className: "tabula-card tabula-widget tabula-widget--quotes" });
    this.element.style.cursor = "pointer";
    this.element.title = "Click for a new quote";

    this.quoteEl = createElement("p", { className: "tabula-widget__quote" });
    this.authorEl = createElement("p", { className: "tabula-widget__author" });
    this.statusEl = createElement("p", { className: "tabula-widget__status" });

    this.element.append(this.quoteEl, this.authorEl, this.statusEl);
    this.element.hidden = true;
    this.element.style.display = "none";

    // Click to get a new random quote
    this.element.addEventListener("click", () => {
      if (!this.isLoading) {
        this.loadQuote();
      }
    });
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

    // Fetch a new quote from Quotable API
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
    this.isLoading = true;
    this.statusEl.textContent = "Loading...";

    this.abortCurrentRequest();
    this.abortController = new AbortController();

    try {
      const result = await fetchQuote(this.abortController.signal);
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
      this.isLoading = false;
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
