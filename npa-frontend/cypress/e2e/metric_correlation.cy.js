describe('Metric Correlation - E2E Test 07 with Full Content Check', () => {
  const appId = 'acorn';

  beforeEach(() => {
    cy.intercept('GET', '**/api/apps').as('getApps');
    cy.intercept('GET', '**/api/metrics/correlations*').as('getCorrelations');

    cy.visit('/correlations');
    
    cy.wait('@getApps', { timeout: 10000 });
  });

  it('calculates correlations and verifies all footer data is rendered', () => {
    const startTs = '1764068739074';
    const endTs = '1764073974211';

    cy.get('select[aria-label="Select app"]', { timeout: 10000 })
      .should('not.be.disabled')
      .select(appId, { force: true });

    cy.contains('label', 'Start TS').parent().find('input')
      .clear({ force: true })
      .type(startTs)
      .should('have.value', startTs);

    cy.contains('label', 'End TS').parent().find('input')
      .clear({ force: true })
      .type(endTs)
      .should('have.value', endTs);

    cy.contains('Loading correlation data...', { timeout: 10000 }).should('not.exist');
    
    cy.wait('@getCorrelations', { timeout: 10000 }).its('response.statusCode').should('eq', 200);

    cy.get('.recharts-responsive-container', { timeout: 10000 })
      .scrollIntoView()
      .should('be.visible')
      .within(() => {
        cy.get('.recharts-bar-rectangle', { timeout: 10000 }).should('have.length.at.least', 1);
      });

    cy.get('table', { timeout: 10000 })
      .scrollIntoView()
      .should('be.visible')
      .within(() => {
        cy.get('tbody tr', { timeout: 10000 }).should('have.length.at.least', 1);

        cy.get('td').each(($td) => {
          const text = $td.text().trim();
          expect(text).to.not.be.empty;
        });
      });

    cy.get('tbody tr').each(($row) => {
      cy.wrap($row).find('td').last().invoke('text').then((text) => {
        const valStr = text.trim();
        if (valStr !== 'null' && valStr !== '') {
          const val = parseFloat(valStr);
          expect(val).to.be.within(-1, 1);
        }
      });
    });
  });
});