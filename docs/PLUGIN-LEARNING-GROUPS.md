# Learning groups in installed plugins

Backend plugin handlers can use `ctx.data.groups` to list a member's groups and
pending invitations, create a group, invite a member, or accept or decline an
invitation. Pass the acting member ID from `@CurrentUser('id')`. Request bodies
may identify the group, invitation or target member. Never read the acting ID
from client input. Validate plugin DTOs as you would for other plugin routes.

Square applies the existing group creator and invitation recipient checks.
A restricted instance must include `learning-groups` in
`SQUARE_CAPABILITIES` to enable both Core routes and plugin calls. Include it in
`NEXT_PUBLIC_SQUARE_CAPABILITIES` to expose the corresponding web routes.
Omitted allowlists retain the full feature set. An installed server plugin is
trusted code and remains responsible for using the authenticated identity.
