import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parseNum(str: any): number | undefined {
  if (!str) return undefined;
  const num = parseFloat(String(str).replace(/,/g, ""));
  return isNaN(num) ? undefined : num;
}

// Scrape wisereport for analyst target prices and ratings
async function fetchWisereport(ticker: string) {
  const data: any = {};
  try {
    const res = await fetch(
      `https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx?cmp_cd=${ticker}&cn=`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return data;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Let's print the tables found
    console.log("Found tables:", $("table").length);

    // Parse individual analyst report table for target prices and ratings
    const targets: number[] = [];
    let buy = 0, hold = 0, sell = 0;

    $("table").each((_, table) => {
      const headerText = $(table).find("tr").first().text();
      
      // Print header text of every table to see what we're actually catching
      console.log("Table header:", headerText.substring(0, 50).replace(/\n/g, "\\n"));

      if (!headerText.includes("제공처") || !headerText.includes("목표가")) return;

      $(table).find("tr").each((j, tr) => {
        if (j === 0) return; // skip header
        const cells: string[] = [];
        $(tr).find("td").each((_, td) => {
          cells.push($(td).text().trim());
        });
        if (cells.length < 6) return;

        console.log("Cells:", cells);

        // cells: [broker, date, targetPrice, prevTarget, change%, rating, prevRating]
        const target = parseNum(cells[2]);
        if (target) targets.push(target);

        const rating = cells[5].toLowerCase();
        if (rating.includes("buy") || rating.includes("매수")) {
          buy++;
        } else if (rating.includes("hold") || rating.includes("중립") || rating.includes("neutral")) {
          hold++;
        } else if (rating.includes("sell") || rating.includes("매도")) {
          sell++;
        }
      });
    });

    if (targets.length > 0) {
      data.highTargetPrice = Math.max(...targets);
      data.lowTargetPrice = Math.min(...targets);
      data.avgTargetPrice = Math.round(targets.reduce((a, b) => a + b, 0) / targets.length);
    }
    data.buyRatings = buy;
    data.holdRatings = hold;
    data.sellRatings = sell;
  } catch (e) {
    console.error(e);
  }
  return data;
}

fetchWisereport("005930").then(console.log);
