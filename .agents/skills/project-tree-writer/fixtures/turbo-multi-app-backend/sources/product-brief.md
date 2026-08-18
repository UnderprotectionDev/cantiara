# Orders everywhere

Web and mobile clients use one separately deployed backend. Both clients share order request and response schemas. Only the backend accesses Postgres through Prisma.
