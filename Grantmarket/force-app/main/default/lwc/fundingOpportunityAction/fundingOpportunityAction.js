import { LightningElement, api, wire } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import getApplicationStatus from '@salesforce/apex/FundingOpportunityController.getApplicationStatus';

export default class FundingOpportunityAction extends NavigationMixin(LightningElement) {
    _recordId;
    applicationId;
    applicationStatus;
    applicationLoaded = false;
    buttonLabel = 'Apply Now';
    isLoading = false;

    @wire(CurrentPageReference)
    currentPageReference;

    // Experience Builder supplies recordId on some page-reference shapes. Keep the
    // public property as the first choice, while retaining URL fallback for /s/detail/<id>.
    @api recordId;

    renderedCallback() {
        if (this.applicationLoaded) {
            return;
        }

        const recordId = this.resolveFundingOpportunityId();
        if (recordId) {
            this._recordId = recordId;
            this.applicationLoaded = true;
            this.loadApplicationData();
        }
    }

    resolveFundingOpportunityId() {
        const pageReference = this.currentPageReference;
        const candidateIds = [
            this.recordId,
            pageReference?.attributes?.recordId,
            pageReference?.state?.recordId,
            pageReference?.state?.c__recordId
        ];

        const pathMatch = window.location.pathname.match(/\/s\/detail\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
        if (pathMatch) {
            candidateIds.push(pathMatch[1]);
        }

        return candidateIds.find((candidate) => /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(candidate || ''));
    }

    loadApplicationData() {
        this.isLoading = true;

        getApplicationStatus({ fundingOpportunityId: this._recordId })
            .then((result) => {
                this.applicationId = result.applicationId;
                this.applicationStatus = result.status;
                this.buttonLabel = result.buttonLabel;
            })
            .catch((error) => {
                // Preserve the enabled button so the user is not stranded after a transient lookup failure.
                // eslint-disable-next-line no-console
                console.error('Unable to load application status.', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleClick() {
        if (this.applicationId) {
            this.navigateToApplicationRecord();
            return;
        }

        this.navigateToOmniScript();
    }

    navigateToApplicationRecord() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.applicationId,
                objectApiName: 'IndividualApplication',
                actionName: 'view'
            }
        });
    }

    navigateToOmniScript() {
        const searchParameters = new URLSearchParams({
            c__layout: 'lightning',
            c__target: 'c:GrantIndividualApplicationEnglish',
            c__ContextId: this._recordId
        });

        // Preserve the active Experience Cloud site path and retain the complete
        // OmniScript query string. This works for any site alias, not just trialorg.
        const siteBasePath = window.location.pathname.split('/s/')[0];
        window.location.assign(`${siteBasePath}/s/lwcos?${searchParameters.toString()}`);
    }
}