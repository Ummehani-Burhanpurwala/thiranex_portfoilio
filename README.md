# Ummehani Burhanpurwala - Portfolio

Multi-page portfolio built with semantic HTML5, ARIA labels, SEO meta tags and an accessible contact form, styled with advanced CSS3.

- CSS Grid for page layouts (named grid areas on Home, About and Contact)
- Flexbox for header, navigation, tags and footer
- Mobile-first media queries at 600px, 900px and 1200px
- CSS custom properties for light/dark themes (OS setting plus a saved toggle in `theme.js`)

Pages: Home, About, Projects, To-Do, Weather, Contact.

Weather dashboard (`weather.html`, `weather.js`, `weather.css`): city search using the Open-Meteo REST API with fetch and async/await, error handling (network, timeout, HTTP, city not found), live temperature, humidity, wind speed and a 5-day forecast.

To-Do app (`todo.html`, `todo.js`, `todo.css`): add, edit, delete and complete tasks; All/Active/Completed filters; data saved in `localStorage`; delegated event listeners. Open `index.html` to run locally.
