/** Turn a Postgres / PostgREST error into something a store manager can act on. */
export function friendlyError(error: { code?: string; message: string } | null): string | null {
  if (!error) return null;
  switch (error.code) {
    case "23P01":
      return "That person is already scheduled during part of that time.";
    case "23514":
      return "Check the times and VRP codes: each shift must end after it starts, and codes are letters and numbers only.";
    case "23505":
      return "That already exists.";
    case "42501":
      return "You don't have permission to change this store.";
    default:
      return error.message;
  }
}
