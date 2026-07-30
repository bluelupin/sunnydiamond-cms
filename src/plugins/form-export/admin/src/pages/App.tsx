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
  {
    type: 'bespoke',
    title: 'Bespoke submissions',
    description: 'Custom-design enquiries and their reference images.',
  },
];

type JobApplication = {
  documentId: string;
  jobID: string;
  jobTitle: string;
  department?: string;
  location?: string;
  applicantName: string;
  email: string;
  phone: string;
  workflowStatus: string;
  createdAt: string;
  resume?: {
    name: string;
    url: string;
  } | null;
};

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
  const [applications, setApplications] = React.useState<JobApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({
    page: 1,
    pageCount: 1,
    total: 0,
  });

  React.useEffect(() => {
    let active = true;

    const loadApplications = async () => {
      setApplicationsLoading(true);

      try {
        const response = await get(
          `/form-export/job-applications?page=${page}&pageSize=25`
        );
        if (!active) return;

        setApplications(response.data?.data ?? []);
        setPagination(
          response.data?.meta?.pagination ?? {
            page,
            pageCount: 1,
            total: 0,
          }
        );
      } catch {
        if (active) {
          toggleNotification({
            type: 'danger',
            message: 'Could not load job applications.',
          });
        }
      } finally {
        if (active) setApplicationsLoading(false);
      }
    };

    void loadApplications();
    return () => {
      active = false;
    };
  }, [get, page, toggleNotification]);

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

          <Box paddingTop={8}>
            <Flex justifyContent="space-between" alignItems="center" gap={4}>
              <Box>
                <Typography variant="alpha" as="h2">
                  Job applications
                </Typography>
                <Box paddingTop={1}>
                  <Typography variant="omega" textColor="neutral600">
                    {pagination.total} applications
                  </Typography>
                </Box>
              </Box>
              <Button
                startIcon={<Download />}
                loading={downloading === 'job'}
                disabled={downloading !== null}
                onClick={() => handleDownload('job')}
              >
                Download all CSV
              </Button>
            </Flex>

            <Box
              background="neutral0"
              borderColor="neutral150"
              hasRadius
              marginTop={4}
              style={{ overflowX: 'auto' }}
            >
              {applicationsLoading ? (
                <Box padding={6}>
                  <Typography>Loading applications…</Typography>
                </Box>
              ) : applications.length === 0 ? (
                <Box padding={6}>
                  <Typography>No job applications found.</Typography>
                </Box>
              ) : (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: 1000,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        'Applied',
                        'Applicant',
                        'Contact',
                        'Job',
                        'Location',
                        'Status',
                        'Resume',
                      ].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            padding: 16,
                            textAlign: 'left',
                            borderBottom: '1px solid #dcdce4',
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.documentId}>
                        <td style={{ padding: 16, verticalAlign: 'top' }}>
                          {new Date(application.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: 16, verticalAlign: 'top' }}>
                          {application.applicantName}
                        </td>
                        <td style={{ padding: 16, verticalAlign: 'top' }}>
                          <div>{application.email}</div>
                          <div>{application.phone}</div>
                        </td>
                        <td style={{ padding: 16, verticalAlign: 'top' }}>
                          <div>{application.jobTitle}</div>
                          <div>{application.jobID}</div>
                        </td>
                        <td style={{ padding: 16, verticalAlign: 'top' }}>
                          {application.location || '—'}
                        </td>
                        <td style={{ padding: 16, verticalAlign: 'top' }}>
                          {application.workflowStatus}
                        </td>
                        <td style={{ padding: 16, verticalAlign: 'top' }}>
                          {application.resume?.url ? (
                            <a
                              href={application.resume.url}
                              target="_blank"
                              rel="noreferrer"
                              download={application.resume.name}
                            >
                              Download resume
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Box>

            <Flex justifyContent="space-between" alignItems="center" paddingTop={4}>
              <Button
                variant="tertiary"
                disabled={page <= 1 || applicationsLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Typography>
                Page {pagination.page} of {Math.max(pagination.pageCount, 1)}
              </Typography>
              <Button
                variant="tertiary"
                disabled={
                  page >= pagination.pageCount || applicationsLoading
                }
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </Flex>
          </Box>
        </Box>
      </Main>
    </Page.Main>
  );
};

export default App;
