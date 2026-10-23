import { test, expect } from "@playwright/test";

test("public classification and private dashboard work end to end", async ({
  page,
  context,
  browser,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use a fictional example" }).click();
  await page
    .getByRole("button", { name: "Classify ticket", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Analysis complete" }),
  ).toBeVisible();
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Username", { exact: true }).fill("alice");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-only-123");
  await page.getByRole("button", { name: "Sign in", exact: false }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(
    page.getByRole("heading", { name: "No tickets found" }),
  ).toBeVisible();
  const session = (await context.cookies()).find(
    (c) => c.name === "smart_ticket_session",
  );
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");
  await page.goto("/tickets/new");
  await page
    .getByLabel("Subject", { exact: true })
    .fill("Fictional duplicate payment");
  await page
    .getByLabel("Description", { exact: false })
    .fill(
      "A fictional credit card was charged twice in a synthetic support scenario. Please help resolve this test transaction.",
    );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Classify & save" }).click();
  await expect(page).toHaveURL(/\/tickets\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("heading", { name: "Fictional duplicate payment" }),
  ).toBeVisible();
  const ticketId = page.url().split("/").pop();
  const changed = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" && r.url().includes(String(ticketId)),
  );
  await page.getByLabel("Status", { exact: true }).selectOption("resolved");
  expect((await changed).status()).toBe(200);
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
    "resolved",
  );
  // Create enough records to exercise server pagination through the same cookie proxy.
  for (let i = 0; i < 10; i++) {
    const response = await page.request.post("/api/backend/tickets", {
      headers: { Origin: "http://127.0.0.1:3100" },
      data: {
        subject: `Synthetic access issue ${i}`,
        description:
          "Fictional user cannot access a test account after resetting a synthetic password.",
        synthetic_data_confirmed: true,
      },
    });
    expect(response.status()).toBe(201);
  }
  // Cross-origin mutations are rejected even with the session cookie.
  expect(
    (
      await page.request.post("/api/backend/tickets", {
        headers: { Origin: "https://untrusted.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await page.goto("/tickets");
  await expect(page.getByText("of 11 tickets", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 / 2")).toBeVisible();
  await page.getByLabel("Search ticket subjects").fill("Fictional duplicate");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: "Fictional duplicate payment",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Filter by status").selectOption("open");
  await expect(
    page.getByRole("heading", { name: "No tickets found" }),
  ).toBeVisible();
  await page.getByLabel("Filter by status").selectOption("resolved");
  await expect(
    page.getByRole("link", {
      name: "Fictional duplicate payment",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "By category" }),
  ).toBeVisible();
  await expect(page.locator(".stat").first().locator("strong")).toHaveText(
    "11",
  );
  await page.screenshot({ path: testInfo.outputPath("analytics-desktop.png"), fullPage: true });
  const other = await browser.newContext();
  const bob = await other.newPage();
  await bob.goto("/login");
  await bob.getByLabel("Username", { exact: true }).fill("bob");
  await bob
    .getByLabel("Password", { exact: true })
    .fill("browser-test-only-123");
  await bob.getByRole("button", { name: "Sign in", exact: false }).click();
  await expect(bob).toHaveURL(/\/tickets$/);
  await expect(
    bob.getByRole("heading", { name: "No tickets found" }),
  ).toBeVisible();
  expect(
    (await bob.request.get(`/api/backend/tickets/${ticketId}`)).status(),
  ).toBe(404);
  await other.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tickets");
  await expect(
    page.getByRole("heading", { name: "My tickets", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("tickets-mobile.png"), fullPage: true });
  await page.goto(`/tickets/${ticketId}`);
  await page
    .getByRole("button", { name: "Delete ticket", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/backend/tickets")).status()).toBe(401);
});
