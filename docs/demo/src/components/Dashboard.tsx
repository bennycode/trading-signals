import {
  BarChart3,
  Settings,
  Search,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  GitFork,
  BookOpen,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

const Sidebar = () => {
  const menuItems = [
    { icon: BarChart3, label: 'Dashboard', active: true },
    { icon: GitFork, label: 'Lifecycle' },
    { icon: Activity, label: 'Analytics' },
    { icon: FileText, label: 'Projects' },
    { icon: Users, label: 'Team' },
  ];

  const documentItems = [
    { icon: BookOpen, label: 'Data Library' },
    { icon: FileText, label: 'Reports' },
    { icon: HelpCircle, label: 'Word Assistant' },
    { icon: MoreHorizontal, label: 'More' },
  ];

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-8">
        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-semibold">A</span>
        </div>
        <span className="font-semibold text-gray-900">Acme Inc.</span>
      </div>

      {/* Quick Create */}
      <Button className="w-full mb-6 bg-black hover:bg-gray-800 text-white">
        Quick Create
      </Button>

      {/* Main Navigation */}
      <nav className="flex-1">
        <ul className="space-y-1 mb-8">
          {menuItems.map((item, index) => (
            <li key={index}>
              <a
                href="#"
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  item.active
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>

        {/* Documents Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Documents
          </h3>
          <ul className="space-y-1">
            {documentItems.map((item, index) => (
              <li key={index}>
                <a
                  href="#"
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center space-x-2 mb-4">
          <Button variant="ghost" size="icon">
            <Settings className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <HelpCircle className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Search className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="flex items-center space-x-3 px-3 py-2 rounded-md bg-gray-100">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-sm font-medium">SC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">shadcn</p>
            <p className="text-xs text-gray-500 truncate">m@example.com</p>
          </div>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  description: string;
  positive?: boolean;
}

const MetricCard = ({ title, value, description, positive = true }: MetricCardProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {positive ? (
          <TrendingUp className="h-4 w-4 text-green-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-600" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

const ChartCard = () => {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Total Visitors</CardTitle>
            <CardDescription>Total for the last 3 months</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button variant="ghost" size="sm">Last 3 months</Button>
            <Button variant="ghost" size="sm">Last 30 days</Button>
            <Button variant="ghost" size="sm">Last 7 days</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 bg-gray-100 rounded-md flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Chart visualization would go here</p>
            <p className="text-sm text-gray-400 mt-2">
              Mobile: 350 • Desktop: 327
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const DocumentsTable = () => {
  const documents = [
    {
      header: 'Cover page',
      sectionType: 'Cover page',
      status: 'In Process',
      target: 18,
      limit: 5,
      reviewer: 'Eddie Lake',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex space-x-4">
            <Button variant="ghost" size="sm">Outline</Button>
            <Button variant="ghost" size="sm" className="bg-blue-100 text-blue-700">
              Past Performance <span className="ml-2 bg-blue-200 text-xs px-2 py-0.5 rounded">3</span>
            </Button>
            <Button variant="ghost" size="sm">
              Key Personnel <span className="ml-2 bg-gray-200 text-xs px-2 py-0.5 rounded">2</span>
            </Button>
            <Button variant="ghost" size="sm">Focus Documents</Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              Customize Columns
            </Button>
            <Button size="sm">Add Section</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-4">#</TableHead>
              <TableHead>Header</TableHead>
              <TableHead>Section Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Limit</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead className="w-4">
                <MoreHorizontal className="h-4 w-4" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{doc.header}</TableCell>
                <TableCell>{doc.sectionType}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {doc.status}
                  </span>
                </TableCell>
                <TableCell>{doc.target}</TableCell>
                <TableCell>{doc.limit}</TableCell>
                <TableCell>{doc.reviewer}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export const Dashboard = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FileText className="w-5 h-5 text-gray-400" />
            <h1 className="text-lg font-semibold text-gray-900">Documents</h1>
          </div>
          <div className="text-sm text-gray-500">GitHub</div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {/* Metrics Grid */}
          <div className="grid gap-4 mb-8 md:grid-cols-4">
            <MetricCard
              title="Total Revenue"
              value="$1,250.00"
              trend="+12.5%"
              description="Trending up this month"
              positive={true}
            />
            <MetricCard
              title="New Customers"
              value="1,234"
              trend="-20%"
              description="Down 20% this period"
              positive={false}
            />
            <MetricCard
              title="Active Accounts"
              value="45,678"
              trend="+12.5%"
              description="Strong user retention"
              positive={true}
            />
            <MetricCard
              title="Growth Rate"
              value="4.5%"
              trend="+4.5%"
              description="Steady performance increase"
              positive={true}
            />
          </div>

          {/* Chart and Additional Cards */}
          <div className="grid gap-6 mb-8 md:grid-cols-3">
            <ChartCard />
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Acquisition needs attention</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Visitors for the last 6 months</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Engagement exceed targets</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Meets growth projections</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Documents Table */}
          <DocumentsTable />
        </main>
      </div>
    </div>
  );
};