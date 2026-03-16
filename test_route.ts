import { GET } from "./app/api/stock/[ticker]/route";
import { NextRequest } from "next/server";

async function testFetch() {
  const req = new NextRequest("http://localhost:3000/api/stock/034220");
  const params = Promise.resolve({ ticker: "034220" });

  try {
    const res = await GET(req, { params });
    const data = await res.json();
    console.log("LG Display Data:", data);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testFetch();
