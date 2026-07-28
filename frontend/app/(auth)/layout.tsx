export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="dark flex min-h-svh flex-col bg-gradient-to-br from-[#8b5cf6] to-[#f3f0ff] text-foreground">
      {children}
    </div>
  );
}
