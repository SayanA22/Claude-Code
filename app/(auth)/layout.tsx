export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">{children}</div>
    </main>
  );
}
