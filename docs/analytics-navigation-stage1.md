# Analytics navigation — stage 1 only

Nine protected URLs share AnalyticsLayout and a scrollable MUI linked-tab submenu.
The existing full AnalyticsPage remains unchanged at /analytics. Eight child URLs
are explicit stage-one informational destinations; they load no financial reports.
Only the active route is mounted. AppRouter now consumes nested route objects.
No period URL parsing, shared filter, financial calculation, confirmation protocol,
backend change or Classification C activation is introduced.

The existing budget draft is component memory. Navigating away from /analytics
unmounts it, as leaving Analytics already did. Submenu navigation introduces more
ways to do so. No draft storage/provider or navigation guard is added in stage 1.
A minimal proposed follow-up, requiring separate owner approval, is a warning or
confirmation before leaving an edited draft, without adding persistence.

Stage 2 content moves and filter changes are not authorized by this implementation.
