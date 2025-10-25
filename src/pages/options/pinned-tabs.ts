import type { PinnedTab } from "$src/settings/schema";

type StatusTone = "default" | "success" | "error";

export type PinnedTabsControllerOptions = {
  list: HTMLElement;
  emptyState: HTMLElement;
  addControls: {
    title: HTMLInputElement;
    url: HTMLInputElement;
    icon: HTMLInputElement;
    submit: HTMLButtonElement;
  };
  maxItems: number;
  generateId: () => string;
  validateUrl: (url: string) => boolean;
  onChange: (tabs: PinnedTab[]) => void;
  setStatus: (message: string, tone?: StatusTone) => void;
};

export type PinnedTabsController = {
  sync: (tabs: readonly PinnedTab[]) => void;
};

type TabMutation = (tabs: PinnedTab[]) => PinnedTab[];

const cloneTab = (tab: PinnedTab): PinnedTab =>
  tab.icon ? { ...tab, icon: tab.icon } : { id: tab.id, title: tab.title, url: tab.url };

const cloneTabs = (tabs: readonly PinnedTab[]): PinnedTab[] => tabs.map(cloneTab);

const resolveLabel = (tab: PinnedTab): string => {
  const trimmedTitle = tab.title.trim();
  if (trimmedTitle.length > 0) {
    return trimmedTitle;
  }
  try {
    const parsed = new URL(tab.url);
    return parsed.hostname.replace(/^www\./i, "") || parsed.hostname;
  } catch {
    return tab.url;
  }
};

const firstSymbol = (value: string): string => {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "•";
};

export const createPinnedTabsController = (
  options: PinnedTabsControllerOptions,
): PinnedTabsController => {
  let tabs: PinnedTab[] = [];

  const emitChange = (): void => {
    options.onChange(cloneTabs(tabs));
  };

  const setAddButtonState = (): void => {
    const { submit } = options.addControls;
    const atLimit = tabs.length >= options.maxItems;
    submit.disabled = atLimit;
    if (atLimit) {
      submit.title = "Maximum pinned tabs reached";
    } else {
      submit.removeAttribute("title");
    }
  };

  const render = (): void => {
    const fragment = document.createDocumentFragment();
    if (tabs.length === 0) {
      options.emptyState.hidden = false;
      fragment.append(options.emptyState);
    } else {
      options.emptyState.hidden = true;
      tabs.forEach((tab, index) => {
        fragment.append(createRow(tab, index));
      });
    }
    options.list.replaceChildren(fragment);
    setAddButtonState();
  };

  const commit = (mutator: TabMutation, message?: string, tone: StatusTone = "success"): void => {
    const next = mutator(cloneTabs(tabs));
    tabs = next;
    emitChange();
    render();
    if (message) {
      options.setStatus(message, tone);
    }
  };

  const updateTab = (index: number, updater: (tab: PinnedTab) => PinnedTab): void => {
    const original = tabs[index];
    if (!original) return;
    tabs[index] = updater(cloneTab(original));
    emitChange();
  };

  const clearIconAt = (index: number): void => {
    updateTab(index, (tab) => {
      const { icon: _removed, ...rest } = tab;
      return rest;
    });
  };

  const createRow = (tab: PinnedTab, index: number): HTMLElement => {
    const row = document.createElement("div");
    row.className = "pinned-item";
    row.dataset["id"] = tab.id;

    const preview = document.createElement("div");
    preview.className = "pinned-item__preview";

    const iconWrapper = document.createElement("span");
    iconWrapper.className = "pinned-item__icon";

    const titleLabel = document.createElement("span");
    titleLabel.className = "pinned-item__title";

    const applyImage = (src: string): void => {
      iconWrapper.replaceChildren();
      const iconImage = document.createElement("img");
      iconImage.className = "pinned-item__icon-image";
      iconImage.src = src;
      iconImage.alt = "";
      iconImage.loading = "lazy";
      iconImage.addEventListener("error", () => {
        clearIconAt(index);
        updatePreview();
        options.setStatus("Icon could not be loaded and was removed", "error");
      });
      iconWrapper.append(iconImage);
    };

    const applyFallback = (seed: string): void => {
      iconWrapper.replaceChildren();
      const fallback = document.createElement("span");
      fallback.className = "pinned-item__icon-fallback";
      fallback.textContent = firstSymbol(seed);
      iconWrapper.append(fallback);
    };

    const updatePreview = (): void => {
      const current = tabs[index];
      if (!current) return;
      const label = resolveLabel(current);
      titleLabel.textContent = label;
      const iconSource = typeof current.icon === "string" ? current.icon.trim() : "";
      if (iconSource) {
        applyImage(iconSource);
      } else {
        applyFallback(label);
      }
    };

    preview.append(iconWrapper, titleLabel);

    const inputs = document.createElement("div");
    inputs.className = "pinned-item__inputs";

    const titleInput = document.createElement("input");
    titleInput.className = "pinned-item__input tabula-input";
    titleInput.value = tab.title;
    titleInput.placeholder = "Title";
    titleInput.setAttribute("aria-label", "Pinned tab title");
    titleInput.maxLength = 40;

    titleInput.addEventListener("input", () => {
      updateTab(index, (current) => ({ ...current, title: titleInput.value }));
      updatePreview();
    });

    titleInput.addEventListener("blur", () => {
      const trimmed = titleInput.value.trim();
      titleInput.value = trimmed;
      updateTab(index, (current) => ({ ...current, title: trimmed }));
      updatePreview();
    });

    const urlInput = document.createElement("input");
    urlInput.className = "pinned-item__input tabula-input";
    urlInput.type = "url";
    urlInput.value = tab.url;
    urlInput.placeholder = "https://example.com";
    urlInput.setAttribute("aria-label", "Pinned tab URL");

    const applyUrlValidity = (value: string): void => {
      const trimmed = value.trim();
      if (!trimmed || options.validateUrl(trimmed)) {
        urlInput.setCustomValidity("");
        delete urlInput.dataset["invalid"];
      } else {
        urlInput.setCustomValidity("Enter a valid URL starting with http or https");
        urlInput.dataset["invalid"] = "true";
      }
    };

    urlInput.addEventListener("input", () => {
      const nextUrl = urlInput.value;
      applyUrlValidity(nextUrl);
      updateTab(index, (current) => ({ ...current, url: nextUrl.trim() }));
      updatePreview();
    });

    urlInput.addEventListener("blur", () => {
      const trimmed = urlInput.value.trim();
      urlInput.value = trimmed;
      applyUrlValidity(trimmed);
      updateTab(index, (current) => ({ ...current, url: trimmed }));
      updatePreview();
    });

    const iconInput = document.createElement("input");
    iconInput.className = "pinned-item__input tabula-input";
    iconInput.type = "url";
    iconInput.value = tab.icon ?? "";
    iconInput.placeholder = "Icon URL";
    iconInput.setAttribute("aria-label", "Pinned tab icon URL");

    iconInput.addEventListener("input", () => {
      const value = iconInput.value.trim();
      if (value.length === 0) {
        clearIconAt(index);
        updatePreview();
        return;
      }
      updateTab(index, (current) => ({ ...current, icon: value }));
      updatePreview();
    });

    inputs.append(titleInput, urlInput, iconInput);

    const actions = document.createElement("div");
    actions.className = "pinned-item__actions";

    const createActionButton = (iconName: string, label: string, handler: () => void, disabled: boolean): HTMLButtonElement => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pinned-item__action tabula-button tabula-button--icon";
      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = iconName;
      button.appendChild(icon);
      button.setAttribute("aria-label", label);
      button.disabled = disabled;
      button.addEventListener("click", handler);
      return button;
    };

    const moveUp = createActionButton("arrow_upward", "Move pinned tab up", () => {
      if (index === 0) return;
      commit((current) => {
        const next = [...current];
        const [entry] = next.splice(index, 1);
        if (!entry) {
          return current;
        }
        next.splice(index - 1, 0, entry);
        return next;
      }, "Pinned tabs reordered");
    }, index === 0);

    const moveDown = createActionButton("arrow_downward", "Move pinned tab down", () => {
      commit((current) => {
        const next = [...current];
        if (index >= next.length - 1) return next;
        const [entry] = next.splice(index, 1);
        if (!entry) {
          return current;
        }
        next.splice(index + 1, 0, entry);
        return next;
      }, "Pinned tabs reordered");
    }, index === tabs.length - 1);

    const remove = createActionButton("delete", "Remove pinned tab", () => {
      commit((current) => current.filter((candidate) => candidate.id !== tab.id), "Pinned tab removed");
    }, false);
    remove.classList.add("pinned-item__action--remove");

    actions.append(moveUp, moveDown, remove);

    row.append(preview, inputs, actions);
    updatePreview();
    return row;
  };

  const { title, url, icon, submit } = options.addControls;

  const resetAddForm = (): void => {
    title.value = "";
    url.value = "";
    icon.value = "";
  };

  const addFromForm = (): void => {
    if (tabs.length >= options.maxItems) {
      options.setStatus("Pinned tabs limit reached", "error");
      return;
    }

    const titleRaw = title.value.trim();
    const urlRaw = url.value.trim();
    const iconRaw = icon.value.trim();

    if (!urlRaw) {
      options.setStatus("Enter a URL to pin", "error");
      url.focus();
      return;
    }

    if (!options.validateUrl(urlRaw)) {
      options.setStatus("Enter a valid URL starting with http or https", "error");
      url.focus();
      return;
    }

    const duplicate = tabs.some((existing) => existing.url.toLowerCase() === urlRaw.toLowerCase());
    if (duplicate) {
      options.setStatus("That site is already pinned", "error");
      url.focus();
      return;
    }

    const label = titleRaw || resolveLabel({ id: "", title: "", url: urlRaw });
    const id = options.generateId();
    const next: PinnedTab = iconRaw ? { id, title: label, url: urlRaw, icon: iconRaw } : { id, title: label, url: urlRaw };

    commit((current) => [...current, next], "Pinned tab added");
    resetAddForm();
    title.focus();
  };

  submit.addEventListener("click", (event) => {
    event.preventDefault();
    addFromForm();
  });

  [title, url, icon].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addFromForm();
      }
    });
  });

  return {
    sync: (nextTabs) => {
      tabs = cloneTabs(nextTabs);
      render();
    },
  };
};
