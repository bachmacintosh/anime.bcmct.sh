addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

addEventListener("scheduled", event => {
  event.waitUntil(handleScheduled(event));
});

async function handleRequest(event) {
  if (event.request.method === "GET") {
    let commitToWatch = await KV.get("commit-to-watch");
    return new Response(commitToWatch, {
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } else if (event.request.method === "POST") {
    const { headers } = event.request;
    const contentType = headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await event.request.json();
      let response = "";
      if (body.secret === REFRESH_SECRET) {
        await fetchAnime();
        response = ["Success"];
      } else {
        response = ["Failure, bad secret"];
      }
      return new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json" },
      });
    } else {
      return new Response("Request was not JSON", {
        headers: { "content-type": "application/json" },
      });
    }
  }
}

async function handleScheduled(event) {
  await fetchAnime();
}

async function fetchAnime() {
  const gql = `
  query {
  MediaListCollection(userId: 122750, type: ANIME sort: STATUS) {
    lists {
      name
      entries {
        media {
          coverImage {
            medium
            large
          }
          title {
            native
            romaji
            english
          }
          description
          episodes
          duration
          format
          averageScore
          studios {
            edges {
              id
              isMain
              node {
                name
              }
            }
          }
          siteUrl
        }
      }
    }
  }
}
  `;
  let planning = null;
  const response = await fetchGraphQL(gql);
  response.data.MediaListCollection.lists.forEach(list => {
    if (list.name === "Planning") {
      planning = list.entries;
    }
  });
  if (planning !== null) {
    const randomIndex = Math.floor(Math.random() * planning.length);
    await KV.put("commit-to-watch", JSON.stringify(planning[randomIndex]));
  } else {
    await KV.put("commit-to-watch", JSON.stringify(null));
  }
}

async function fetchGraphQL(query) {
  return fetch("https://graphql.anilist.co/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANILIST_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  }).then(response => {
    return response.json();
  });
}
