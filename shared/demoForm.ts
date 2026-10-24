// A made-up application packet bundled with the app, so the demo never depends on a real person's form.
// The API returns a cached checklist for this exact text, so the demo works even if the AI quota runs out.
export const DEMO_FORM_TEXT = `SAMPLE APARTMENTS RENTAL APPLICATION (DEMO ONLY)

Please return this application to the leasing office by November 14, 2026.
A non-refundable application fee of $35 per adult is due with your application.

Bring the following documents:
- Government-issued photo ID for every adult household member
- Pay stubs for the last 2 months
- Your most recent federal tax return or W-2
- Bank statements for the last 3 months

Income certification interview: call (202) 555-0199 to schedule.
Questions? Email leasing@sample-apartments.example`

export const DEMO_CHECKLIST = [
  { type: 'deadline', label: 'Return the application', quote: 'return this application to the leasing office by November 14, 2026' },
  { type: 'fee', label: 'Application fee, $35 per adult', quote: 'application fee of $35 per adult' },
  { type: 'document', label: 'Photo ID for every adult', quote: 'Government-issued photo ID for every adult household member' },
  { type: 'document', label: 'Two months of pay stubs', quote: 'Pay stubs for the last 2 months' },
  { type: 'document', label: 'Latest tax return or W-2', quote: 'most recent federal tax return or W-2' },
  { type: 'document', label: 'Three months of bank statements', quote: 'Bank statements for the last 3 months' },
  { type: 'contact', label: 'Call to schedule your income interview', quote: 'call (202) 555-0199 to schedule' },
] as const
