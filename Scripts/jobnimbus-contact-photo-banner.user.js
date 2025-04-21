// ==UserScript==
// @name        JobNimbus Contact Photos
// @match       *://webappui.jobnimbus.com/*
// @grant       GM_xmlhttpRequest
// @version     1.0
// @author      Syntask
// @description Adds a Google Streetview image in place of the contact image in JobNimbus that nobody uses.
// ==/UserScript==

function getCookieValue(name) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

let lastUrl = window.location.href;

// MutationObserver to detect URL changes
const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log("URL changed to: ", lastUrl);

        const currentUrl = window.location.href;
        const contactId = currentUrl.split('/').pop();

        // Construct the URL with the extracted segment
        const apiUrl = `https://app.jobnimbus.com/api2/getcontact?id=${contactId}&jobid=0&duplicate_from_id=undefined&_=${Date.now()}`;

        console.log(apiUrl);

        // Retrieve the necessary cookie values
        const authToken = getCookieValue('JNAuth');
        const messagesUtk = getCookieValue('messagesUtk');
        const refreshToken = getCookieValue('refreshToken');

        // Retrieve the Bearer token from local storage
        const bearerToken = localStorage.getItem('jn.auth.legacyAccessToken');

        if (!bearerToken) {
            console.error('Bearer token not found in local storage');
            return;
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: apiUrl,
            headers: {
                "Authorization": `Bearer ${bearerToken}`,
                "Cookie": `JNAuth=${authToken}; messagesUtk=${messagesUtk}; refreshToken=${refreshToken}`
            },
            onload: function(response) {
                console.log("Response status: ", response.status);
                console.log("Response text: ", response.responseText);

                if (response.status !== 200) {
                    console.error('Network response was not ok');
                    return;
                }

                const data = JSON.parse(response.responseText);
                const contact = data[0];
                const addressURLcomponent = encodeURIComponent(contact.AddressLine1 + ",+" + contact.City + ",+" + contact.StateText + "+" + contact.Zip);
                const GMAPS_PRIVATE_KEY = "AIzaSyBP1a0tgc3DPtAtlasSPtRyZdeGAuzMjv8"
                const satelliteImg = "https://maps.googleapis.com/maps/api/staticmap?center=" + addressURLcomponent + "&zoom=20&size=2000x1000&maptype=satellite&key=" + GMAPS_PRIVATE_KEY;
                const streetviewImg = "https://maps.googleapis.com/maps/api/streetview?size=640x640&location=" + addressURLcomponent + "&fov=90&key=" + GMAPS_PRIVATE_KEY;
                console.log("Updated contact data: ", contact);
                console.log("Generated satellite image URL: ", satelliteImg);

                // Create and append a new style tag if not present
                const styleTag = document.createElement('style');
                styleTag.setAttribute('data-jobnimbus-style', 'true');
                styleTag.innerHTML = `
                    #windowUpdateContactViewData {
                    background: url(${streetviewImg});
                    background-size: cover;
                    background-repeat: no-repeat;
                    background-position: center;
                    border-radius: 16px 16px 8px 8px;
                    margin: 0px 16px;
                    }
                
                    #PanelAddContact1{
                        background: linear-gradient(0deg,rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0));
                        backdrop-filter: blur(2px);
                        border: none !important;
                        border-radius: 16px 16px 8px 8px !important;
                        padding: 24px;
                    }

                    #PanelAddContact1 div div div.left img {
                        display: none;
                    }

                    #PanelAddContact1 div div div.left_with_20leftmargin:has(> span.span_big_title) {
                        margin-top: 180px;
                        margin-left: 0;
                    }

                    span.span_subheader {
                    color: #000;
                    }

                `;

                document.head.appendChild(styleTag);
                console.log("Style tag injected successfully with new satellite image URL.");
            },
            onerror: function(error) {
                console.error('There was a problem with the XMLHttpRequest operation:', error);
            }
        });
    }
});

// Start observing the document for URL changes
observer.observe(document, { subtree: true, childList: true });