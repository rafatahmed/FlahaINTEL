# PostgreSQL failure

1. Check service, disk, and connections.
2. Confirm app role is not superuser.
3. If corrupt, restore latest dump into isolated host first.
4. Promote restore only after integrity checks.
5. Update readiness and notify operators.
