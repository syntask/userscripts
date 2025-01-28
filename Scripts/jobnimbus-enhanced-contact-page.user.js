// ==UserScript==
// @name        JobNimbus Enhanced Contact Page
// @match       *://webappui.jobnimbus.com/*
// @grant       GM_xmlhttpRequest
// @version     1.0.0 build 2501281521
// @author      Syntask
// @description Enhances the JobNimbus contact page with additional functionality
// @downloadURL https://raw.githubusercontent.com/syntask/userscripts/main/Scripts/jobnimbus-enhanced-contact-page.user.js
// @updateURL   https://raw.githubusercontent.com/syntask/userscripts/main/Scripts/jobnimbus-enhanced-contact-page.user.js
// ==/UserScript==


let lastUrl = window.location.href;

function getCookieValue(name) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

// Retry mechanism to ensure buttonContainer exists
function waitForElement(selector, callback, interval = 100, maxRetries = 50) {
    let retries = 0;
    const intervalId = setInterval(() => {
        const element = document.querySelector(selector);
        if (element) {
            clearInterval(intervalId);
            callback(element);
        } else if (retries++ >= maxRetries) {
            clearInterval(intervalId);
            console.error(`Element "${selector}" not found after ${maxRetries} retries`);
        }
    }, interval);
}

function injectElement(element, contact) {
    const typeOfWork = contact.custom_fields.find(field => field.Name === 'cf_string_6').Value;
    const DateCreated = new Date(contact.DateCreated * 1000);

    const insCo = contact.custom_fields.find(field => field.Name === 'cf_string_1').Value;
    const policyNum = contact.custom_fields.find(field => field.Name === 'cf_string_5').Value;
    const claimNum = contact.custom_fields.find(field => field.Name === 'cf_string_2').Value;
    const ded = contact.custom_fields.find(field => field.Name === 'cf_double_1').Value;
    const dedString = Number(ded).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const dateOfLossU = contact.custom_fields.find(field => field.Name === 'cf_date_1').Value;
    const dateOfLoss = new Date(dateOfLossU * 1000);
    const dateOfLossString = dateOfLoss.toLocaleDateString();

    const addressURLcomponent = encodeURIComponent(contact.AddressLine1 + " " + contact.City + " " + contact.StateText + " " + contact.Zip);
    const GMAPS_PRIVATE_KEY = "AIzaSyBP1a0tgc3DPtAtlasSPtRyZdeGAuzMjv8"
    const satelliteImg = "https://maps.googleapis.com/maps/api/staticmap?center=" + addressURLcomponent + "&zoom=20&size=2000x1000&maptype=satellite&key=" + GMAPS_PRIVATE_KEY;
    const streetviewImg = "https://maps.googleapis.com/maps/api/streetview?size=640x640&location=" + addressURLcomponent + "&fov=60&key=" + GMAPS_PRIVATE_KEY;
    const googleMapsLink = "https://www.google.com/maps/search/?api=1&query=" + addressURLcomponent;


    const html = `
    <div class="ctx-main">
        <div class="ctx-map">
            <div id="map">
                <div class="ctx-map-overlay"></div>
            </div>
        </div>
        <div class="ctx-content">
            <div class="ctx-content-left">
                <div class="ctx-streetview-image-container">
                    <a href="${googleMapsLink}" target="_blank">
                    <img src="${streetviewImg}" alt="Street View Image" class="ctx-streetview-image">
                    </a>
                </div>
            </div>

            <div class="ctx-content-middle">

                <div class="ctx-flex-col-stretch">

                    <div class="ctx-flex-col">
                        <span class="ctx-contactnumber">#<span class="ctx-copygroup">${contact.ContactNumber}</span></span>
                        <span class="ctx-lg-title"><span class="ctx-copygroup">${contact.display_name}</span><span class="ctx-status"><div class="ctx-status-dot"></div>${contact.Status.Name}</span></span>
                        <div class="ctx-addressgroup ctx-flex-col">
                            <span><span class="ctx-copygroup">${contact.AddressLine1}</span></span>
                            <span><span class="ctx-copygroup">${contact.City}</span>, <span class="ctx-copygroup">${contact.StateText}</span> <span class="ctx-copygroup">${contact.Zip}</span></span>
                        </div>
                        <span class="ctx-md-title"><span class="ctx-bold">${typeOfWork}</span> | ${contact.ContactType.Name}</span>
                    </div>


                    <div class="ctx-flex-col">
                        <div class="ctx-columns">
                            <div class="ctx-col">
                                <span class="ctx-col-title">Customer Info</span>
                                <span><span class=ctx-bold>First Name: </span><span class="ctx-copygroup">${contact.FirstName}</span></span>
                                <span><span class=ctx-bold>Last Name: </span><span class="ctx-copygroup">${contact.LastName}</span></span>
                                <span><span class=ctx-bold>Email: </span><span class="ctx-copygroup">${contact.Email}</span></span>
                                <span><span class=ctx-bold>Phone: </span><span class="ctx-copygroup" data-copy-data="${contact.HomePhone}">(${contact.HomePhone.slice(0, 3)}) ${contact.HomePhone.slice(3, 6)}-${contact.HomePhone.slice(6)}</span></span>
                            </div>
                            <div class="ctx-col">
                                <span class="ctx-col-title">Workflow</span>
                                <span><span class=ctx-bold>Created: </span><span class="ctx-copygroup">${DateCreated.toLocaleDateString()}</span></span>
                                <span><span class=ctx-bold>Lead Source: </span><span class="ctx-copygroup">${contact.Source.Name}</span></span>
                                <span><span class=ctx-bold>Days in Status: </span><span class="ctx-copygroup">${contact.DaysInStatus}</span></span>
                                <span><span class=ctx-bold>Sales Rep: </span><span class="ctx-copygroup">${contact.SalesRep.Name}</span></span>
                            </div>
                                <div class="ctx-col">
                                <span class="ctx-col-title">Claim</span>
                                <span><span class=ctx-bold>Insurance Co: </span><span class="ctx-copygroup">${insCo}</span></span>
                                <span><span class=ctx-bold>Policy #: </span><span class="ctx-copygroup">${policyNum}</span></span>
                                <span><span class=ctx-bold>Claim #: </span><span class="ctx-copygroup">${claimNum}</span></span>
                                <span><span class=ctx-bold>Date of Loss: </span><span class="ctx-copygroup">${dateOfLossString}</span></span>
                                <span><span class=ctx-bold>Deductible: </span><span class="ctx-copygroup">${dedString}</span></span>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
            <div class="ctx-content-right">
            </div>
        </div>
    </div>

    <style>
        html {

        }
        .ctx-lg-title {
            font-weight: bold;
            font-size: 30px;
        }

        .ctx-bold {
            font-weight: bold;
        }

        .ctx-md-title {
            font-size: 18px;
        }

        .ctx-col-title {
            font-weight: bold;
            font-size: 16px;
            color: #777777;
        }

        .ctx-contactnumber {
            font-weight: normal;
            opacity: 0.5;
            font-size: 12px;
        }

        .ctx-addressgroup {
            margin-bottom: 4px;
        }

        .ctx-addressgroup span{
            font-size: 18px;
            font-weight: normal;
        }

        .ctx-status-dot {
            display: inline-block;
            width: .6em;
            height: .6em;
            border-radius: 999px;
            background-color: #007bff;
            margin-bottom: .02em;
            margin-right: .2em;
            animation: pulse 4s infinite;
        }

        @keyframes pulse {
            0% {
                transform: scale(1);
            }

            20% {
                transform: scale(.8);
            }

            40% {
                transform: scale(.8);
            }

            60% {
                transform: scale(1);
            }

            100% {
                transform: scale(1);
            }
        }

        .ctx-status {
            background-color: rgb(255, 255, 255);
            padding: .2em .8em .2em .4em;
            border-radius: 999px;
            box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.1);
            font-size: 18px;
            font-weight: normal;
            position: relative;
            top: -.25em;
            left: .4em;
            text-wrap: nowrap;
        }

        .ctx-link-button {
            display: block;
            padding: 8px 16px;
            background-color: #007bff;
            color: white;
            text-align: center;
            font-weight: bold;
            text-decoration: none;
            border-radius: 8px;
            transition: background-color .2s;
        }

        .ctx-link-button:hover {
            background-color: #0066d2;
        }

        .ctx-flex-col {
            display: flex;
            flex-direction: column;
        }

        .ctx-flex-col-stretch {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .ctx-columns {
            display: flex;
            flex-direction: row;
            gap: 16px;
            flex-wrap: wrap;
        }

        .ctx-col {
            width: max-content;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .ctx-copygroup {
            border-radius: 4px;
            transition: box-shadow .2s, background-color .2s;
        }

        .ctx-copygroup.active {
            cursor: cell;
            background-color: rgba(0, 155, 255, 0.15);
            box-shadow: 0px 0px 0px 0px rgba(0, 155, 255, 0.15);
        }

        .ctx-copygroup.active:hover {
            background-color: rgba(0, 155, 255, 0.4);
            box-shadow: 0px 0px 0px 3px rgba(0, 155, 255, 0.4);
        }

        .ctx-main {
            font-family: Arial, sans-serif;
            --ctx-left-size: 200px;
            --ctx-right-size: 100px;
            font-size: 14px;
            background-color: rgb(245, 245, 245);
            position: relative;
        }

        .ctx-content {
            position: relative;
            display: flex;
            flex-direction: row;
            padding: 20px;
            gap: 20px;
        }

        .ctx-content-left {
            flex-grow: 0;
        }
        .ctx-content-middle {
            flex-grow: 1;
        }
        .ctx-content-right {
            flex-grow: 0;
            width: var(--ctx-right-size);
        }

        .ctx-streetview-image-container {
            background-color: rgb(255, 255, 255);
            width: var(--ctx-left-size);
            height: var(--ctx-left-size);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0px 0px 32px 0px rgba(0, 0, 0, 0.2);
        }

        .ctx-streetview-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            margin: none;
            padding: none;
            border-radius: 8px;
        }

        .ctx-map {
            position: absolute;
            top: 0;
            right: calc(var(--ctx-right-size) * -.25);
            width: calc(var(--ctx-right-size) * 2.5);
            height: 100%; /* Ensure it fills its parent */
            z-index: 0;
        }

        .ctx-map-overlay {
            position: absolute;
            top: 0;
            right: 0;
            width: 100%;
            height: 100%;
            --color-r: 245;
            --color-g: 245;
            --color-b: 245;
            background: linear-gradient(90deg, rgba(var(--color-r), var(--color-g), var(--color-b), 1) 0%, rgba(var(--color-r), var(--color-g), var(--color-b), 0) 33%, rgba(var(--color-r), var(--color-g), var(--color-b), 0) 100%);
            z-index: 1;
        }

        #map {
            width: 100%;
            height: 100%;
        }

        .maplibregl-ctrl-attrib.maplibregl-compact {
            display: none;
        }

        .ctx-copymessage {
            position: absolute;
            top: 0;
            left: 0;
            background-color: rgb(255, 255, 255);
            backdrop-filter: blur(20px);
            color: rgb(0, 0, 0);
            padding: 5px;
            border-radius: 5px;
            border: 1px solid rgba(0, 0, 0, 0.2);
            animation: fadeOut 1s forwards;
        }

        /* ctx-copymessage fade out animation */
        @keyframes fadeOut {
            0% {
                transform-origin: top left;
                transform: scale(.9);
                opacity: 0;
            }

            20% {
                transform: scale(1);
                opacity: 1;
            }

            80% {
                transform: scale(1);
                opacity: 1;
            }

            100% {
                transform-origin: top left;
                transform: scale(.9);
                opacity: 0;
            }
        }

        @media screen and (max-width: 1000px) {
            
        }

    </style>
    `;
    
    const oldElements = document.querySelectorAll(".ctx-main-container");
    oldElements.forEach(element => {
        element.remove();
    });

    
    const newElement = document.createElement("div")
    newElement.classList.add("ctx-main-container");
    
    console.log(element)
    
    newElement.innerHTML = html;
    console.log(newElement)
    
    const parent = document.querySelector("#windowUpdateContactView1")
    console.log("Inserting newElement")
    parent.insertBefore(newElement, element);
    console.log("Inserted newElement")
    
    element.style.setProperty("display", "none", "important");
    
    const menuButton = document.querySelector("#PanelAddContact1 div.width100 div div.right")
    const destinationNode = document.querySelector("div.ctx-content-right")
    
    if (!menuButton){
        console.log("Menu button not found!");
    } else {
        console.log("Menu button found...");
        console.log(menuButton);
    }
    // Ensure both elements are found
    if (menuButton && destinationNode) {
        // Move the menuButton into the destinationNode
        destinationNode.appendChild(menuButton);
    } else {
        console.log("menuButton or destinationNode not found");
    }


    


    // MARK: - Clipboard functionality

    const copyGroups = document.querySelectorAll('.ctx-copygroup');

    document.addEventListener('keydown', event => {
        if (event.key === 'Control' || event.key === 'Meta') {
            copyGroups.forEach(group => {
                group.classList.add('active');
            });
        }
    });

    document.addEventListener('keyup', event => {
        if (event.key === 'Control' || event.key === 'Meta') {
            copyGroups.forEach(group => {
                group.classList.remove('active');
            });
        }
    });

    copyGroups.forEach(group => {
        group.addEventListener('click', () => {
            // First make sure the group is active
            if (!group.classList.contains('active')) return;
            // If the group has a data-copy-data attribute, use that as the text to copy
            const text = group.getAttribute('data-copy-data') || group.textContent;
            const temp = document.createElement('textarea');
            temp.value = text;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            // Display a small temporary message next to the pointer
            const message = document.createElement('div');
            message.classList.add('ctx-copymessage');
            message.textContent = 'Copied!';
            message.style.top = `${event.clientY}px`;
            message.style.left = `${event.clientX}px`;
            document.body.appendChild(message);
            setTimeout(() => {
                document.body.removeChild(message);
            }, 1000);
        });
    });
}



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
                const addressLine1 = contact.AddressLine1;

                // Wait for the buttonContainer to exist before injecting the button
                waitForElement('#windowUpdateContactViewData', (menuButton) => {


                    const targetNode = document.querySelector('#windowUpdateContactViewData');
                    
                    console.log('Injecting new contact panel for the first time');
                    injectElement(targetNode, contact);

                });
            },
            onerror: function(error) {
                console.error('There was a problem with the XMLHttpRequest operation:', error);
            }
        });
    }
});

// Start observing the document for URL changes
observer.observe(document, { subtree: true, childList: true });
