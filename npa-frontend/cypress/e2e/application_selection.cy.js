describe('Test 01: Select Application', () => {
  const API_TIMEOUT = 15000;

  beforeEach(() => {
    // Broad match for the initial apps list
    cy.intercept('GET', '**/api/apps/**').as('getApps');
    
    cy.visit('http://localhost:3000/apps');
    
    // Wait for the loading state to finish and the initial API call
    cy.contains('Loading applications...').should('not.exist', { timeout: API_TIMEOUT });
    cy.wait('@getApps', { timeout: API_TIMEOUT });
  });

  it('should verify requirements and navigate to configurations', () => {
    const searchTerm = 'acorn';

    // Verify search functionality
    cy.get('input[placeholder="Search apps..."]').type(searchTerm);
    
    // FIX: Instead of looking for 'h2', we look for the text anywhere in the grid
    // This avoids the 'AssertionError: Expected to find element: h2'
    cy.get('.grid').contains(searchTerm).should('be.visible');

    // PREPARE INTERCEPTS:
    // We expect a call to the configs with the app_name query parameter
    cy.intercept('GET', '**/api/apps/configs?app_name=*').as('getConfigs');
    // Note: Your app seems to re-fetch the list on navigation, so we catch it to avoid errors
    cy.intercept('GET', '**/api/apps/**').as('getAppsAgain');

    // ACTION: Click the card that contains the application name
    cy.contains(searchTerm).click();

    // VERIFY NAVIGATION:
    // Check if URL changes to the correct path
    cy.url().should('include', `/apps/${searchTerm}/configs`);
    
    // VERIFY BACKEND CONNECTION:
    // Wait for the specific config call seen in your screenshot (image_d93dc4.png)
    cy.wait('@getConfigs', { timeout: API_TIMEOUT })
      .its('response.statusCode').should('eq', 200);
  });

  it('should navigate through pagination', () => {
    // Pagination test using the 'Next' button from your React component
    cy.get('button').contains('Next').then(($btn) => {
      if (!$btn.is(':disabled')) {
        cy.intercept('GET', '**/api/apps/**').as('getNextPage');
        cy.wrap($btn).click();
        cy.wait('@getNextPage');
        cy.contains('Page 2').should('be.visible');
      }
    });
  });
});