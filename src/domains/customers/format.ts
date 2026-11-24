type Address = {
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export function formatAddress({ street, city, state, postal_code }: Address) {
  const region = [state, postal_code].filter(Boolean).join(" ");
  return [street, city, region].filter(Boolean).join(", ");
}
