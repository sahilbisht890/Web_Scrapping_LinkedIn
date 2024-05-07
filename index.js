import puppeteer from 'puppeteer';
import XLSX from "xlsx";
let count = 0;
let objData = [];
let MAXDATA=5;

(async () => {


  //Inputs
  const searchFields = 'technology';
  const country = 'russia'
  const industry = 'it';
  const companySizeId = '#companySize-F';
  const email = '9634423121';
  const password = 'heroSA890';

  /*
      FOR THE COMAPNY SIZE USING ID : 

      ID >> companySize-B :  1-10 employees 
      ID >> companySize-C :  11-50 employees 
      ID >> companySize-D :  51-200 employees 
      ID >> companySize-E :  201-500 employees 
      ID >> companySize-F :  501-1000 employees 
      ID >> companySize-G :  1001-5000 employees 
      ID >> companySize-H :  5001-10,000 employees 
  */



  const browser = await puppeteer.launch({ headless: false ,slowMo:30});
  const page = await browser.newPage();

  await page.goto('https://linkedin.com', {
    args: [
      '--incognito'
    ],
    timeout: 30000,
  });
  await page.setViewport({ width: 1280, height: 1024 });

  //logging into  the linkedin account 

  await page.waitForSelector('#session_key');
  await page.type('#session_key', email);
  await page.waitForSelector('#session_password');
  await page.type('#session_password', password);
  await page.keyboard.press('Enter');
  await page.waitForNavigation();

  //getting the company button  and clicking on it 

  await page.waitForSelector('.search-global-typeahead__input');
  await page.type('.search-global-typeahead__input', searchFields);
  await page.keyboard.press('Enter');
  await page.waitForNavigation();

  await page.waitForSelector('.search-reusables__primary-filter');
  const btn = await page.$$('.search-reusables__primary-filter')
  let index = 0;

  for (let i in btn) {
    const textContent = await page.evaluate(element => element.textContent, btn[i]);
    if (textContent.trim() == 'Companies') {
      console.log(i);
      index = i;
      break;
    }
  }
  
  // delay(1000);

  //clicking on the companies option 

  const companyBtn = await btn[index].$('button');
  await companyBtn.click();
  await page.waitForNavigation();

  //appling filter using the function filters for country and industry

  await filters('#searchFilter_companyHqGeo', 'Add a location', country, page, 0);
  await filters('#searchFilter_industryCompanyVertical', 'Add an industry', industry, page, 1);

 
  // for Company size filter 
  const companySize = await page.waitForSelector('#searchFilter_companySize');
  await companySize.click();

  const chosenCompany = await page.waitForSelector(companySizeId);
  chosenCompany.click();
  await page.waitForSelector('button[data-control-name="filter_show_results"]');
  const Allbuttons = await page.$$('button[data-control-name="filter_show_results"]')
  await Allbuttons[2].click();

  //for navigate to the next page and fetching the data from the each page
  while (true) 
    {
    try {

      if(MAXDATA==0)break;      //breaking the loop when MAXDATA is zero 
      await dataFetch(page, browser);
      const nextBtn = await page.waitForSelector('button[aria-label="Next"]');
      let continueOrNot = await page.evaluate(element => element.disabled, nextBtn);

      console.log(continueOrNot);
      if (continueOrNot) break;   //if there is no next page exit the loop

      await nextBtn.click();
    }
    catch (error) {
      console.log('no next button');
      break;
    }
  }

  console.log(objData);  //printing the data
  toExcel(objData, country, searchFields,industry);  //converting the data into the excel file 
  await browser.close();    //closing the browser

})();

//filter function 
async function filters(id, placeholder, select, page, index) {
  const locationFilter = await page.waitForSelector(id);
  await locationFilter.click();

  const currentInput = await page.waitForSelector(`input[placeholder="${placeholder}"]`);
  await currentInput.type(select);


  let idLocationSuggestion = await page.$eval(`input[placeholder="${placeholder}"]`,
    inputElement => inputElement.getAttribute('aria-controls')
  );

  idLocationSuggestion = '#' + idLocationSuggestion;
  await page.waitForSelector(idLocationSuggestion);
  const locationSuggestionElement = await page.$(idLocationSuggestion);

  const spans = await locationSuggestionElement.$$('.search-typeahead-v2__hit-text');
  let flag = true;

  //finding the value match from the options and clicking on it 
  for (let i in spans) 
  {
    const valueInside = await page.evaluate(element => element.innerText.trim(), spans[i]);

    if (valueInside.toLowerCase() == select)
    {
        await spans[i].click();
        flag = false;
        break;
    }

  }

//if there is no match value ,clicking on the first options shown

  if (flag) 
  {
      const firstSuggestionLocation = await locationSuggestionElement.$('.search-typeahead-v2__hit-text');
      await firstSuggestionLocation.click();

  }


  await page.waitForSelector('button[data-control-name="filter_show_results"]');
  const Allbuttons = await page.$$('button[data-control-name="filter_show_results"]')
  await Allbuttons[index].click();

}

//function to fetch the data from the page
async function dataFetch(page, browser)
{
  let links = [];
  const dataContainer = await page.waitForSelector('.search-results-container');
  let listCard = await dataContainer.$$('.reusable-search__result-container');
  
  //fetching the link from the data and adding about/ to it so can directly navigate there 
  for (let i in listCard) 
    {
      let val = listCard[i];
      let sizeOfData = await val.$$('div');
      if (sizeOfData.length > 1) 
      {
         let anchor = await val.$('a');
         //storing the link in array

         const linkaddress = await page.evaluate(element => element.getAttribute('href'), anchor);

         links.push(linkaddress + 'about/');
      }
    };
    

  //fetching the data from each links 
  for (let i in links) 
  {
      if(MAXDATA==0)break;
      
      //storing the fetch Data into val and storing it
      let val = await fetchDataValue(links[i], browser);
      ++count;
      console.log("Total Iteration : ", count);
      if (Object.keys(val).length != 0)
           {
            objData.push(val);
            --MAXDATA;
           }

  }
}

//function to fetch the value from the each link 

async function fetchDataValue(link, browser) {

  //opening the link into the new tab
  const page = await browser.newPage();

  await page.goto(link, {
    args: [
      '--incognito'
    ],
    timeout: 100000,
  });
  await page.setViewport({ width: 1080, height: 1024 });


  //Delay for around 2 seconds
  await delay(800);

  const fetchingValues = await page.evaluate(() => {
    let tempData = {};
    try {
      console.log('fetchingValue');
      const datalist = document.querySelector('dl');
      if (datalist == null) return {};

      const companyname = document.querySelector('h1').innerText.trim();
      tempData['Company Name'] = companyname;

      const dt = Array.from(datalist.querySelectorAll('dt')); 
      const dd = Array.from(datalist.querySelectorAll('dd')); 

      //these fields value data we are fetching 
      const neededFields = ['Website', 'Industry', 'Company size', 'Headquarters', 'Phone','Founded'];
      let index = 0;

      dt.forEach((val) => {
        let dataFieldValue = val.innerText.trim();

        if (neededFields.includes(dataFieldValue)) 
        {

          let dataValue = dd[index].innerText.trim();
          if (dataFieldValue == 'Phone')
                dataValue = dataValue.slice(0, dataValue.indexOf('P') - 1);

          tempData[dataFieldValue] = dataValue;

          if (dataFieldValue == 'Company size' && dt.length < dd.length)
                ++index;
        }
        ++index;

      });

    }
    catch (err) {
      return {};
    }

    console.log(tempData);
    return tempData;
  });

  await page.close();

  return fetchingValues;
}

//converting the data into the excel file 
function toExcel(data, country, searchFields,industry)
{
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${country + searchFields + industry}data.xlsx`);
}
//function for delay 
function delay(ms)
{
  return new Promise(resolve => setTimeout(resolve, ms));
}
