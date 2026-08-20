# smoke-fixtures — the positive control for `plugin-smoke.php`

A check that has never failed is not known to work. These fixtures exist so CI
proves the smoke check can REJECT a bad plugin before it is trusted to APPROVE a
good one.

`nested-function.php` reproduces the v2.9.0 outage exactly: a function declared
inside another function's body. It is valid PHP, `php -l` passes it, and it
fataled every page on the live site including wp-admin.

CI runs the check against this file and requires a NON-ZERO exit. If the fixture
ever starts passing, the check has stopped checking — and that is the failure
this repo keeps meeting in other costumes: the version grep that compared
nothing, the deploy file list that went blind, the `git diff` over a pathspec
that matched nothing and returned the SHA-1 of empty input.

These files are never deployed. `deploy-mu-plugins.yml` copies
`website/wp-mu-plugin/*.php` only; nothing here is under that path.
