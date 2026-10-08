import type { JournalInsights } from "./journal-insights";
import { formatESICategories } from "./esi";
import { getString } from "./locale";

export function presentJournalInsights(result: JournalInsights, locale: string) {
  const basis = (value?: JournalInsights["esiBasis"]) => value
    ? getString("journal-insights-match-detail", { args: { basis: getString(`journal-insights-basis-${value}`) } })
    : "";
  return [
    {
      label: getString("field-esi"),
      matched: !result.esiError && result.categories.length > 0,
      value: result.esiError
        ? getString("journal-insights-unavailable")
        : formatESICategories(result.categories, locale.startsWith("zh") ? "{subject}" : "{en}") || getString("journal-insights-unmatched"),
      basis: result.esiError ? "" : basis(result.esiBasis),
      source: getString(result.esiSource === "custom" ? "journal-insights-esi-custom" : "journal-insights-esi-builtin"),
      warning: result.esiError || (result.customFallback ? `${getString("journal-insights-custom-fallback")} ${result.customFallback}` : ""),
    },
    {
      label: getString("field-nature-index"),
      matched: !result.natureError && result.natureIndex === true,
      value: result.natureError
        ? getString("journal-insights-unavailable")
        : getString(result.natureIndex ? "journal-insights-member" : "journal-insights-unmatched"),
      basis: result.natureError ? "" : basis(result.natureBasis),
      source: getString(result.natureSource === "custom" ? "journal-insights-nature-custom" : "journal-insights-nature-builtin"),
      warning: result.natureError || (result.natureFallback ? `${getString("journal-insights-nature-fallback")} ${result.natureFallback}` : ""),
    },
  ];
}
