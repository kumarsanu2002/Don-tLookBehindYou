const LINKEDIN_URL = 'https://www.linkedin.com/in/kumar-sanu-57a990227/'

export function CraftedBy() {
  return (
    <a
      className="crafted-by"
      data-text="CRAFTED BY SANU"
      href={LINKEDIN_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Crafted by Sanu — opens the LinkedIn profile"
    >
      <span className="crafted-by-fill">&laquo;</span>
      <span className="crafted-by-text">CRAFTED BY SANU</span>
      <span className="crafted-by-fill">&raquo;</span>
      <span className="crafted-by-cursor">_</span>
    </a>
  )
}
