import * as React from 'react';

import { Box, Button, Flex, Main, Typography } from '@strapi/design-system';
import { Download } from '@strapi/icons';
import { Page, useFetchClient, useNotification } from '@strapi/strapi/admin';

const exports = [
  {
    type: 'generic',
    title: 'Generic submissions',
    description: 'Appointments and general lead forms.',
  },
  {
    type: 'product',
    title: 'Product submissions',
    description: 'Product enquiry and personalisation forms.',
  },
];

const getFilename = (response: any, fallback: string) => {
  const disposition = response.headers?.['content-disposition'];
  const match = disposition?.match(/filename="([^"]+)"/);

  return match?.[1] || fallback;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const App = () => {
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [downloading, setDownloading] = React.useState<string | null>(null);

  const handleDownload = async (type: string) => {
    setDownloading(type);

    try {
      const response = await get(`/form-export/submissions/${type}.csv`, {
        responseType: 'blob',
      });

      downloadBlob(
        response.data,
        getFilename(response, `sunny-${type}-submissions.csv`)
      );
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: 'Could not export submissions.',
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Page.Main>
      <Main>
        <Box padding={8}>
          <Box paddingBottom={6}>
            <Typography variant="alpha" as="h1">
              Form Export
            </Typography>
            <Box paddingTop={2}>
              <Typography variant="epsilon" textColor="neutral600">
                Download submission data as CSV files.
              </Typography>
            </Box>
          </Box>

          <Flex direction="column" alignItems="stretch" gap={4}>
            {exports.map((item) => (
              <Box
                key={item.type}
                background="neutral0"
                borderColor="neutral150"
                hasRadius
                padding={5}
              >
                <Flex justifyContent="space-between" alignItems="center" gap={4}>
                  <Box>
                    <Typography variant="beta" as="h2">
                      {item.title}
                    </Typography>
                    <Box paddingTop={1}>
                      <Typography variant="omega" textColor="neutral600">
                        {item.description}
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    startIcon={<Download />}
                    loading={downloading === item.type}
                    disabled={downloading !== null}
                    onClick={() => handleDownload(item.type)}
                  >
                    Download CSV
                  </Button>
                </Flex>
              </Box>
            ))}
          </Flex>
        </Box>
      </Main>
    </Page.Main>
  );
};

export default App;
