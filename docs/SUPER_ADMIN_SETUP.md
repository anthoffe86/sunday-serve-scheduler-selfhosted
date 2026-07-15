# Super Admin Setup

This document records the current super-admin setup for the multi-tenant support model.

## Current Super Admin Account

- Super-admin email: `servetogether2002@gmail.com`
- Password: stored separately outside this repository

## Role Model

The application now distinguishes between organisation admins and super admins.

- `admin`: organisation-scoped admin role
  - Can manage volunteers, schedules, swaps, and organisation settings within their own organisation
  - Cannot perform global support operations across organisations
- `super_admin`: global support role
  - Can access the separate `/super-admin` area
  - Can perform support actions across organisations such as:
    - password reset
    - email change
    - add user
    - remove user
  - Should not be used for organisation schedule management

## Current Intended Setup

- The super-admin login email is `servetogether2002@gmail.com`
- The password must not be stored in source control
- If the password changes, update your separate secure record only

## Related Migrations

These migrations introduced the current setup:

- `20260715122900_add_super_admin_enum.sql`
- `20260715123000_multitenancy_foundation.sql`
- `20260715131500_super_admin_bootstrap.sql`
- `20260715143000_transfer_super_admin_to_servetogether2002.sql`

## Notes

- The super-admin account should be used for support and tenant administration only
- Organisation-specific scheduling should continue through organisation admin accounts
- If the super-admin email changes again, update the login account and then update this file
