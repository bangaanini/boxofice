
Filmbox API

Premium Movie Database and Streaming Links.
Active Key
1303c05ea2d7ad68dc2027ed5e75895a5bc5d773823b7da670000582f36f1bd9


1. GET
Get home page data (Banners & Categories)
/api/filmbox/home
curl -X GET "https://indocast.site/api/filmbox/home" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 1303c05ea2d7ad68dc2027ed5e75895a5bc5d773823b7da670000582f36f1bd9"

2. GET
/api/filmbox/trending
Get trending movies and dramas
pagequery
perPagequery
curl -X GET "https://indocast.site/api/filmbox/trending?page=0&perPage=18" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 1303c05ea2d7ad68dc2027ed5e75895a5bc5d773823b7da670000582f36f1bd9"

3. POST
/api/filmbox/search
Search for movies, dramas, or animes by keyword
keywordbody
pagebody
perPagebody
subjectTypebody
curl -X POST "https://indocast.site/api/filmbox/search" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 1303c05ea2d7ad68dc2027ed5e75895a5bc5d773823b7da670000582f36f1bd9" \
  -d '{"keyword":"hollywood","page":"1","perPage":"1","subjectType":"2"}'

4. GET
/api/filmbox/details
Get detail info for a specific movie
detailPathquery
curl -X GET "https://indocast.site/api/filmbox/details?detailPath=timur-MUyFxi62XA7" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 1303c05ea2d7ad68dc2027ed5e75895a5bc5d773823b7da670000582f36f1bd9"
  
5. GET
/api/filmbox/getplay
Get playback stream URL and subtitles
subjectIdquery
detailPathquery
sequery
epquery
langquery
curl -X GET "https://indocast.site/api/filmbox/getplay?subjectId=6375320143991919952&detailPath=timur-MUyFxi62XA7&se=0&ep=0&lang=in_id" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 1303c05ea2d7ad68dc2027ed5e75895a5bc5d773823b7da670000582f36f1bd9"
