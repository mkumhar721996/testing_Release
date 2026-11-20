import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';

// A malformed id can never match a uuid column, so report it as not found
// instead of letting Postgres reject the query with a 500.
export const uuidParam = (code: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () => new NotFoundException({ code }),
  });
