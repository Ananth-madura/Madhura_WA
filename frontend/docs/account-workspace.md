# Account workspace direction and verification

Reading this as: WhatsApp sender management for organization administrators, using the existing corporate navy workbench, ENERGY 2 / RHYTHM 2 / MOTION 1.

The source of design direction is `frontend/design.md`. The antislop plugin is applied during implementation, using its UI, accessibility and mobile rules. No visual assets are generated or installed.

## Design decisions

- Color: existing navy establishes work-surface hierarchy; yellow marks the selected section. Connection status always includes text.
- Layout: a dense sender list supports comparing real connections; an inline details area holds branch routing and credentials without obscuring the list.
- Typography: existing Poppins headings and Inter body text preserve the application's identity; monospace is limited to provider IDs.
- Spacing: separate connection setup, routing and activity with section dividers; mobile stacks these tasks in source order.
- Controls: text actions name the operation. No decorative icons, gradients, glows, illustrations or invented quality metrics.
- Motion: existing hover and focus feedback only; loading states include text and respect reduced motion.
- States: empty, loading and retryable errors are explicit. Provider values that have not been returned remain unknown.

Implementation and verification notes will be recorded here with the final changes.
