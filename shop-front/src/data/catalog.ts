// The swappable catalog data seam (Phase 2, MOCK-03).
//
// UI phases import `fetchCatalogPage` from HERE, never from the mock source
// directly. The Phase 7 mock->real swap is a one-line change: re-export from
// './catalog.source.real' instead of './catalog.source.mock'.
export {
  fetchCatalogPage,
  // Landing-feed rail fetchers (Phase 4). Rail UI imports these from the seam
  // only, so the Phase 7 mock->real swap stays a one-line re-export change.
  fetchFeaturedProducts,
  fetchTrendingProducts,
  fetchCategories,
} from './catalog.source.real'
