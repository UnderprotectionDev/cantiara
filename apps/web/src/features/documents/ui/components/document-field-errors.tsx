export default function FieldErrors({
  errors,
}: {
  errors: readonly ({ message: string } | undefined)[];
}) {
  return errors
    .filter((error) => error !== undefined)
    .map((error) => (
      <p key={error.message} role="alert">
        {error.message}
      </p>
    ));
}
